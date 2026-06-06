import { customerSchema } from '../schemas/customer'
import { whatsappSessionSchema } from '../schemas/whatsappSession'
import { bookingSchema } from '../schemas/booking'
import { slotSchema } from '../schemas/slot'
import { serviceRecordSchema } from '../schemas/serviceRecord'
import { staffSchema } from '../schemas/staff'
import { branchSchema } from '../schemas/branch'
import { adminUserSchema } from '../schemas/adminUser'

export const schemaTypes = [
  whatsappSessionSchema,
  branchSchema,
  staffSchema,
  customerSchema,
  bookingSchema,
  slotSchema,
  serviceRecordSchema,
  adminUserSchema,
]
