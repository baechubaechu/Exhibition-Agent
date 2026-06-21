import ExhibitFloorClient from "./ExhibitFloorClient";
import { PeriodicRemount } from "../components/PeriodicRemount";

export default function ControlHomePage() {
  return (
    <PeriodicRemount>
      <ExhibitFloorClient />
    </PeriodicRemount>
  );
}
