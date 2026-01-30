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

import handler from '../api/mark-cell.js';

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
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue(finalResult),
    single: vi.fn().mockResolvedValue(finalResult),
  };
  return chain;
}

describe('POST /api/mark-cell', () => {
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
    mockAuth.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad' } });
    const res = mockRes();
    await handler(mockReq('POST', { boardId: 'b', playerId: 'p', cellIndex: 0 }), res);
    expect(res.statusCode).toBe(401);
  });

  it('rejects missing required fields', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const res = mockRes();
    await handler(mockReq('POST', { boardId: 'b' }), res);
    expect(res.statusCode).toBe(400);
  });

  it('rejects if player belongs to different user', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    mockFrom.mockReturnValue(
      chainMock({ data: { id: 'p1', user_id: 'u2', board_id: 'b', name: 'X', color: '#fff' }, error: null })
    );

    const res = mockRes();
    await handler(mockReq('POST', { boardId: 'b', playerId: 'p1', cellIndex: 0 }), res);
    expect(res.statusCode).toBe(403);
  });

  it('rejects toggling FREE cell (null topic_id)', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    mockFrom.mockImplementation((table) => {
      if (table === 'players') {
        return chainMock({ data: { id: 'p1', user_id: 'u1', board_id: 'b', name: 'X', color: '#fff' }, error: null });
      }
      if (table === 'player_cards') {
        return chainMock({ data: { id: 1, topic_id: null, marked: true }, error: null });
      }
      return chainMock({ data: null, error: null });
    });

    const res = mockRes();
    await handler(mockReq('POST', { boardId: 'b', playerId: 'p1', cellIndex: 4 }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/FREE/);
  });

  it('toggles a cell and returns no bingo', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });

    const allCells = Array.from({ length: 9 }, (_, i) => ({
      cell_index: i,
      marked: i === 4,
      grid_size: 3,
    }));

    let playerCardsCallIndex = 0;
    mockFrom.mockImplementation((table) => {
      if (table === 'players') {
        return chainMock({ data: { id: 'p1', user_id: 'u1', board_id: 'b', name: 'X', color: '#fff' }, error: null });
      }
      if (table === 'player_cards') {
        playerCardsCallIndex++;
        if (playerCardsCallIndex === 1) {
          return chainMock({ data: { id: 10, topic_id: 5, marked: false }, error: null });
        }
        if (playerCardsCallIndex === 2) {
          const chain = chainMock({ error: null });
          chain.update.mockReturnValue(chain);
          return chain;
        }
        if (playerCardsCallIndex === 3) {
          const chain = chainMock({});
          chain.order.mockResolvedValue({ data: allCells, error: null });
          return chain;
        }
      }
      return chainMock({ data: null, error: null });
    });

    const res = mockRes();
    await handler(mockReq('POST', { boardId: 'b', playerId: 'p1', cellIndex: 0 }), res);
    expect(res.body.cellIndex).toBe(0);
    expect(res.body.marked).toBe(true);
    expect(res.body.bingo.bingo).toBe(false);
  });

  it('detects bingo and inserts bingo_event', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });

    const allCells = Array.from({ length: 9 }, (_, i) => ({
      cell_index: i,
      marked: i <= 2 || i === 4,
      grid_size: 3,
    }));

    let playerCardsCallIndex = 0;
    mockFrom.mockImplementation((table) => {
      if (table === 'players') {
        return chainMock({ data: { id: 'p1', user_id: 'u1', board_id: 'b', name: 'X', color: '#fff' }, error: null });
      }
      if (table === 'player_cards') {
        playerCardsCallIndex++;
        if (playerCardsCallIndex === 1) {
          return chainMock({ data: { id: 10, topic_id: 5, marked: false }, error: null });
        }
        if (playerCardsCallIndex === 2) {
          const chain = chainMock({ error: null });
          chain.update.mockReturnValue(chain);
          return chain;
        }
        if (playerCardsCallIndex === 3) {
          const chain = chainMock({});
          chain.order.mockResolvedValue({ data: allCells, error: null });
          return chain;
        }
      }
      if (table === 'bingo_events') {
        return chainMock({ error: null });
      }
      return chainMock({ data: null, error: null });
    });

    const res = mockRes();
    await handler(mockReq('POST', { boardId: 'b', playerId: 'p1', cellIndex: 2 }), res);
    expect(res.body.bingo.bingo).toBe(true);
    expect(res.body.bingo.winningLine).toEqual([0, 1, 2]);
    expect(mockFrom).toHaveBeenCalledWith('bingo_events');
  });
});
