import { describe, expect, it, vi } from "vitest";
import { RoomManager } from "../../src/ws/rooms.js";
import { WsPollNotifier } from "../../src/ws/ws-notifier.js";
import { makePoll } from "../helpers/fakes.js";

// Aqui o RoomManager é real, mas "espionamos" seus métodos com vi.spyOn:
// o teste verifica O QUE o notifier pede às salas, sem precisar de sockets.
function setup() {
  const rooms = new RoomManager();
  const broadcast = vi.spyOn(rooms, "broadcast");
  const closeRoom = vi.spyOn(rooms, "closeRoom");
  return { notifier: new WsPollNotifier(rooms), broadcast, closeRoom };
}

describe("WsPollNotifier", () => {
  it("broadcasts the full totals on pollUpdated", () => {
    const { notifier, broadcast } = setup();
    const poll = makePoll({
      id: "pollAbc2",
      options: [
        { id: "1", text: "Yes", votes: 4 },
        { id: "2", text: "No", votes: 1 },
      ],
    });

    notifier.pollUpdated(poll);

    expect(broadcast).toHaveBeenCalledWith("pollAbc2", {
      type: "poll:updated",
      pollId: "pollAbc2",
      totals: { "1": 4, "2": 1 },
      totalVotes: 5,
    });
  });

  it("broadcasts poll:closed on pollClosed", () => {
    const { notifier, broadcast } = setup();

    notifier.pollClosed(makePoll({ id: "pollAbc2" }));

    expect(broadcast).toHaveBeenCalledWith("pollAbc2", { type: "poll:closed", pollId: "pollAbc2" });
  });

  it("broadcasts poll:removed and then empties the room", () => {
    const { notifier, broadcast, closeRoom } = setup();

    notifier.pollRemoved("pollAbc2");

    expect(broadcast).toHaveBeenCalledWith("pollAbc2", {
      type: "poll:removed",
      pollId: "pollAbc2",
    });
    expect(closeRoom).toHaveBeenCalledWith("pollAbc2");
    // A ordem importa: se a sala fosse esvaziada antes, ninguém receberia o aviso.
    expect(broadcast.mock.invocationCallOrder[0]).toBeLessThan(
      closeRoom.mock.invocationCallOrder[0],
    );
  });
});
