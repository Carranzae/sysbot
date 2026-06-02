import { Module } from '@nestjs/common';
import { SwarmOrchestratorService } from './swarm-orchestrator.service';
import { SwarmController } from './swarm.controller'; 
import { DatabaseModule } from '../database/database.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { PeruvianNlpService } from './peruvian-nlp.service';
import { PeruvianToneService } from './peruvian-tone.service';

@Module({
  imports: [DatabaseModule, WebsocketModule],
  providers: [SwarmOrchestratorService, PeruvianNlpService, PeruvianToneService],
  controllers: [SwarmController],
  exports: [SwarmOrchestratorService, PeruvianNlpService, PeruvianToneService],
})
export class SwarmModule {}
