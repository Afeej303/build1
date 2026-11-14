import { Module } from '@nestjs/common';
import { AppointmentsController } from './appointments.controller.js';
import { HospitalController } from './hospital.controller.js';

@Module({ controllers: [HospitalController, AppointmentsController] })
export class HospitalModule {}
