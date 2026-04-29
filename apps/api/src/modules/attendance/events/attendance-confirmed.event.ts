export class AttendanceConfirmedEvent {
  constructor(
    public readonly employeeId: string,
    public readonly yearMonth: string,
  ) {}
}
