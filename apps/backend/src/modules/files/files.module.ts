import { Module, forwardRef } from '@nestjs/common';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { AiModule } from '../ai/ai.module';
import { BusinessModule } from '../business/business.module';

@Module({
  imports: [AiModule, forwardRef(() => BusinessModule)],
  providers: [FilesService],
  controllers: [FilesController],
  exports: [FilesService],
})
export class FilesModule {}
