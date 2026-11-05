import { beforeEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import type { ServerMessage } from "../../../shared/ws.js";
import { RoomManager, type RoomSocket } from "../../src/ws/rooms.js";

// Socket falso: só o que o RoomManager usa (readyState + send), guardando o que recebeu.
class FakeSocket implements RoomSocket {
  readyState: number = WebSocket.OPEN;
  readonly received: ServerMessage[] = [];

  send(data: string): void {
    this.received.push(JSON.parse(data) as ServerMessage);
  }

  takeAll(): ServerMessage[] {
    return this.received.splice(0);
  }
}

let rooms: RoomManager;
let a: FakeSocket;
let b: FakeSocket;

beforeEach(() => {
  rooms = new RoomManager();
  a = new FakeSocket();
  b = new FakeSocket();
});

describe("join and leave", () => {
  it("counts sockets per room and tells the room how many are watching", () => {
    rooms.join(a, "poll1");
    rooms.join(b, "poll1");

    expect(rooms.count("poll1")).toBe(2);
    expect(a.takeAll()).toEqual([
      { type: "viewers", pollId: "poll1", count: 1 },
      { type: "viewers", pollId: "poll1", count: 2 },
    ]);
    expect(b.takeAll()).toEqual([{ type: "viewers", pollId: "poll1", count: 2 }]);
  });

  it("broadcasts the new count when someone leaves", () => {
    rooms.join(a, "poll1");
    rooms.join(b, "poll1");
    a.takeAll();

    rooms.leave(b);

    expect(rooms.count("poll1")).toBe(1);
    expect(a.takeAll()).toEqual([{ type: "viewers", pollId: "poll1", count: 1 }]);
  });

  it("moves a socket to the new room when it joins another poll", () => {
    rooms.join(a, "poll1");
    rooms.join(a, "poll2");

    expect(rooms.count("poll1")).toBe(0);
    expect(rooms.count("poll2")).toBe(1);
    expect(rooms.roomOf(a)).toBe("poll2");
  });

  it("ignores joining the room the socket is already in", () => {
    rooms.join(a, "poll1");
    a.takeAll();

    rooms.join(a, "poll1");

    expect(rooms.count("poll1")).toBe(1);
    expect(a.takeAll()).toEqual([]);
  });

  it("ignores leave for a socket that is in no room", () => {
    expect(() => rooms.leave(a)).not.toThrow();
    expect(rooms.roomOf(a)).toBeUndefined();
  });
});

describe("broadcast", () => {
  const update: ServerMessage = { type: "poll:closed", pollId: "poll1" };

  it("reaches only the sockets in that room", () => {
    rooms.join(a, "poll1");
    rooms.join(b, "poll2");
    a.takeAll();
    b.takeAll();

    rooms.broadcast("poll1", update);

    expect(a.takeAll()).toEqual([update]);
    expect(b.takeAll()).toEqual([]);
  });

  it("skips sockets that are not OPEN", () => {
    rooms.join(a, "poll1");
    rooms.join(b, "poll1");
    a.takeAll();
    b.takeAll();
    b.readyState = WebSocket.CLOSING;

    rooms.broadcast("poll1", update);

    expect(a.takeAll()).toEqual([update]);
    expect(b.takeAll()).toEqual([]);
  });

  it("does nothing for a room nobody is watching", () => {
    expect(() => rooms.broadcast("nobody", update)).not.toThrow();
  });
});

describe("closeRoom", () => {
  it("empties the room without broadcasting and forgets each socket's room", () => {
    rooms.join(a, "poll1");
    rooms.join(b, "poll1");
    a.takeAll();

    rooms.closeRoom("poll1");

    expect(rooms.count("poll1")).toBe(0);
    expect(rooms.roomOf(a)).toBeUndefined();
    expect(a.takeAll()).toEqual([]);
  });
});
