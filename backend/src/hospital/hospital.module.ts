import { HospitalAdminController } from './hospital-admin.controller.js';
import { Module } from '@nestjs/common';
import { AppointmentsController } from './appointments.controller.js';
import { HospitalController } from './hospital.controller.js';
import { IncidentsController } from './incidents.controller.js';

@Module({
  controllers: [
    HospitalController,
    AppointmentsController,
    HospitalAdminController,
    IncidentsController,
  ],
})
export class HospitalModule {}
