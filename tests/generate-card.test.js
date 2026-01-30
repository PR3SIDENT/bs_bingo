import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAuth, mockFrom } = vi.hoisted(() => ({
  mockAuth: { getUser: vi.fn() },
  mockFrom: vi.fn(),
}));

vi.mock('../lib/supabase-admin.js', () => ({
  supabaseAdmin: {
    auth: mockAuth,
    from: mockFrom,
  },
}));

import handler from '../api/generate-card.js';

function mockReq(method, body = {}, token = 'valid-token') {
  return {
    method,
    body,
    headers: { authorization: token ? `Bearer ${token}` : '' },
  };
}

function mockRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) { res.statusCode = code; return res; },
    json(data) { res.body = data; return res; },
  };
  return res;
}

function chainMock(finalResult) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue(finalResult),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue(finalResult),
    single: vi.fn().mockResolvedValue(finalResult),
  };
  return chain;
}

describe('POST /api/generate-card', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects non-POST methods', async () => {
    const res = mockRes();
    await handler(mockReq('GET'), res);
    expect(res.statusCode).toBe(405);
  });

  it('rejects missing token', async () => {
    const res = mockRes();
    await handler(mockReq('POST', {}, ''), res);
    expect(res.statusCode).toBe(401);
  });

  it('rejects invalid token', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid' } });
    const res = mockRes();
    await handler(mockReq('POST', { boardId: 'abc', playerId: 'p1' }), res);
    expect(res.statusCode).toBe(401);
  });

  it('rejects missing boardId or playerId', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const res = mockRes();
    await handler(mockReq('POST', {}), res);
    expect(res.statusCode).toBe(400);
  });

  it('rejects if player not found', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    mockFrom.mockReturnValue(chainMock({ data: null, error: { message: 'not found' } }));

    const res = mockRes();
    await handler(mockReq('POST', { boardId: 'abc', playerId: 'p1' }), res);
    expect(res.statusCode).toBe(404);
  });

  it('rejects if player belongs to different user', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    mockFrom.mockReturnValue(chainMock({ data: { id: 'p1', user_id: 'u2', board_id: 'abc' }, error: null }));

    const res = mockRes();
    await handler(mockReq('POST', { boardId: 'abc', playerId: 'p1' }), res);
    expect(res.statusCode).toBe(403);
  });

  it('rejects if not enough topics', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    mockFrom.mockImplementation((table) => {
      if (table === 'players') {
        return chainMock({ data: { id: 'p1', user_id: 'u1', board_id: 'abc' }, error: null });
      }
      if (table === 'topics') {
        const chain = chainMock({});
        chain.order.mockResolvedValue({ data: [{ id: 1, text: 'A' }], error: null });
        return chain;
      }
      return chainMock({ data: null, error: null });
    });

    const res = mockRes();
    await handler(mockReq('POST', { boardId: 'abc', playerId: 'p1' }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/Need at least/);
  });

  it('creates a card with correct number of cells for 3x3', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });

    const topics = Array.from({ length: 8 }, (_, i) => ({ id: i + 1, text: `Topic ${i + 1}` }));

    mockFrom.mockImplementation((table) => {
      if (table === 'players') {
        return chainMock({ data: { id: 'p1', user_id: 'u1', board_id: 'abc' }, error: null });
      }
      if (table === 'topics') {
        const chain = chainMock({});
        chain.order.mockResolvedValue({ data: topics, error: null });
        return chain;
      }
      if (table === 'player_cards') {
        const chain = chainMock({ error: null });
        chain.delete.mockReturnValue(chain);
        chain.insert.mockResolvedValue({ error: null });
        return chain;
      }
      return chainMock({ data: null, error: null });
    });

    const res = mockRes();
    await handler(mockReq('POST', { boardId: 'abc', playerId: 'p1' }), res);
    expect(res.statusCode).toBe(201);
    expect(res.body.gridSize).toBe(3);
    expect(res.body.cells).toHaveLength(9);
    const freeCell = res.body.cells.find(c => c.cellIndex === 4);
    expect(freeCell.text).toBe('FREE');
    expect(freeCell.marked).toBe(true);
    const topicCells = res.body.cells.filter(c => c.text !== 'FREE');
    expect(topicCells).toHaveLength(8);
    topicCells.forEach(c => {
      expect(c.text).toMatch(/^Topic \d+$/);
      expect(c.marked).toBe(false);
    });
  });
});
