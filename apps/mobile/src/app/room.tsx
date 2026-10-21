import { Redirect } from 'expo-router';

/** A page of the game with others (online): no solo screen leads to it, and the phone plays offline, so it goes home. */
export default function RoomRoute() {
  return <Redirect href="/" />;
}
