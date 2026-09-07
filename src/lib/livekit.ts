import { Room, RoomEvent } from "livekit-client";

export async function joinRoom(url: string, token: string, stream?: MediaStream) {
  const room = new Room({ adaptiveStream: true, dynacast: true });
  await room.connect(url, token);

  if (stream) {
    for (const track of stream.getTracks()) {
      await room.localParticipant.publishTrack(track);
    }
  }

  return room;
}

export { RoomEvent };
