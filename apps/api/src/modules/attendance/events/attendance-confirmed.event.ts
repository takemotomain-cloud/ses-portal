export class AttendanceConfirmedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly employeeId: string,
    public readonly yearMonth: string,
  ) {}
}
