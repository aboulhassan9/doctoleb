import { appointmentService } from './appointments.js';
import { patientFormsService } from './patientForms.js';

function getErrorMessage(error, fallback = 'Request failed') {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  return error.message || fallback;
}

export const patientBookingService = {
  async getBookingDefinition({ patientId = null, doctorId = null, visitTypeId = null } = {}) {
    return patientFormsService.getDefinition({
      context: 'appointment_booking',
      patientId,
      doctorId,
      visitTypeId,
    });
  },

  async bookVisit({ booking, definition = null, form = {} } = {}) {
    const bookingResult = await appointmentService.bookFromSlot(booking);
    if (bookingResult.error || !bookingResult.data) {
      return {
        data: null,
        error: getErrorMessage(bookingResult.error, 'Unable to book appointment.'),
      };
    }

    const hasAnswerFields = Boolean(
      definition?.answerFieldKeys?.length || definition?.customFieldKeys?.length
    );

    if (!hasAnswerFields) {
      return {
        data: {
          appointment: bookingResult.data,
          answers: null,
          partialSuccess: {
            appointmentBooked: true,
            bookingAnswersSaved: true,
          },
        },
        error: null,
      };
    }

    const answersResult = await patientFormsService.submitAppointmentAnswers({
      appointmentId: bookingResult.data.id,
      definition,
      form,
    });

    return {
      data: {
        appointment: bookingResult.data,
        answers: answersResult.data || null,
        partialSuccess: {
          appointmentBooked: true,
          bookingAnswersSaved: !answersResult.error,
        },
      },
      error: answersResult.error || null,
    };
  },
};
