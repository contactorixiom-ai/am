import { Module } from '@nestjs/common';
import { AdminDocumentsController } from './admin-documents.controller';
import { AdminDocumentsService } from './admin-documents.service';

@Module({
  controllers: [AdminDocumentsController],
  providers: [AdminDocumentsService],
})
export class AdminDocumentsModule {}
