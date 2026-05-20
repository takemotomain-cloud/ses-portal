import { Controller, Get, Post, Param, Body, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CertificatesService } from './certificates.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

@ApiTags('証明書')
@ApiBearerAuth()
@Controller('certificates')
@UseGuards(JwtAuthGuard)
export class CertificatesController {
  constructor(private readonly certificatesService: CertificatesService) {}

  @Get()
  @ApiOperation({ summary: '自分の証明書一覧' })
  async getMyCertificates(@CurrentUser() user: RequestUser) {
    return this.certificatesService.getMyCertificates(user.employeeId, user.tenantId);
  }

  @Post('request')
  @ApiOperation({ summary: '証明書発行申請' })
  async request(@CurrentUser() user: RequestUser, @Body('certType') certType: string) {
    return this.certificatesService.requestCertificate(user.employeeId, certType, user.tenantId);
  }

  @Get('pending')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '未発行の証明書一覧（管理者用）' })
  async getAllPending() {
    return this.certificatesService.getAllPending();
  }

  @Post(':id/issue')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '証明書を発行する（管理者用）' })
  async issue(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('filePath') filePath: string,
    @CurrentUser() user: RequestUser,
  ) {
    await this.certificatesService.issueCertificate(id, filePath, user.employeeId);
    return { message: '証明書を発行しました' };
  }
}
