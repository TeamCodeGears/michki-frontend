// src/pages/Schedule.jsx
import { useParams } from "react-router-dom";
import ScheduleMap from "../components/ScheduleMap";

export default function Schedule() {
  const { planId, shareURI } = useParams();
  return <ScheduleMap key={shareURI ?? planId ?? "schedule-root"} />;
}
