import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { NotifyService } from './notify.service';
import { NotifyController } from './notify.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Notification])],
  providers: [NotifyService],
  controllers: [NotifyController],
  exports: [NotifyService],
})
export class NotifyModule {}
