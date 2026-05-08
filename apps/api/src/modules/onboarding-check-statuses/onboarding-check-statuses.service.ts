import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

const ALLOWED_ITEM_KEYS = [
  'offer',
  'labor',
  'identity',
  'mynumber',
  'pension',
  'resident',
  'employmentInsurance',
  'bank',
  'emergency',
  'dependents',
  'qualifications',
] as const;

type AllowedItemKey = (typeof ALLOWED_ITEM_KEYS)[number];

@Injectable()
export class OnboardingCheckStatusesService {
  constructor(private readonly db: DatabaseService) {}

  private assertItemKey(itemKey: string): asserts itemKey is AllowedItemKey {
    if (!ALLOWED_ITEM_KEYS.includes(itemKey as AllowedItemKey)) {
      throw new BadRequestException(`未対応の itemKey: ${itemKey}`);
    }
  }

  async listByEmployee(employeeId: string) {
    return this.db.onboardingCheckStatus.findMany({
      where: { employeeId },
      orderBy: { itemKey: 'asc' },
    });
  }

  async upsertManualStatus(args: {
    employeeId: string;
    itemKey: string;
    method?: string;
    confirmedAt?: string;
    memo?: string;
    confirmedBy?: string;
  }) {
    this.assertItemKey(args.itemKey);

    return this.db.onboardingCheckStatus.upsert({
      where: {
        employeeId_itemKey: {
          employeeId: args.employeeId,
          itemKey: args.itemKey,
        },
      },
      create: {
        employeeId: args.employeeId,
        itemKey: args.itemKey,
        status: 'done',
        method: args.method || null,
        confirmedAt: args.confirmedAt ? new Date(args.confirmedAt) : new Date(),
        memo: args.memo || null,
        confirmedBy: args.confirmedBy || null,
      },
      update: {
        status: 'done',
        method: args.method || null,
        confirmedAt: args.confirmedAt ? new Date(args.confirmedAt) : new Date(),
        memo: args.memo || null,
        confirmedBy: args.confirmedBy || null,
      },
    });
  }

  async clearManualStatus(employeeId: string, itemKey: string) {
    this.assertItemKey(itemKey);
    await this.db.onboardingCheckStatus.deleteMany({
      where: { employeeId, itemKey },
    });
    return { success: true };
  }
}
