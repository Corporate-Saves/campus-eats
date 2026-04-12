import { StudentPushSetup } from "@/components/student/StudentPushSetup";

export default function StudentDashboardPage() {
  return (
    <div>
      <StudentPushSetup />
      <h1 className="text-2xl font-semibold text-text">Home</h1>
      <p className="mt-2 text-sm text-muted">Student · dashboard</p>
    </div>
  );
}
