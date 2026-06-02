import { customerSchema } from '../schemas/customer'
import { bookingSchema } from '../schemas/booking'
import { slotSchema } from '../schemas/slot'
import { serviceRecordSchema } from '../schemas/serviceRecord'
import { staffSchema } from '../schemas/staff'
import { branchSchema } from '../schemas/branch'

export const schemaTypes = [
  branchSchema,
  staffSchema,
  customerSchema,
  bookingSchema,
  slotSchema,
  serviceRecordSchema,
]
