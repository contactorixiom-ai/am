import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../../../common/decorators/current-user.decorator';
import { SignaturesService } from './signatures.service';
import { SignDocumentDto } from './dto/sign-document.dto';

@ApiTags('signatures')
@ApiBearerAuth()
@Controller('documents')
export class SignaturesController {
  constructor(private readonly signatures: SignaturesService) {}

  @Post(':id/sign')
  @ApiOperation({ summary: 'Signer électroniquement un document (eIDAS — niveau simple)' })
  sign(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SignDocumentDto,
  ) {
    return this.signatures.sign(id, user, dto);
  }
}
