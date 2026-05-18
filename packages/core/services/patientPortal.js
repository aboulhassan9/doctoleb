import { isFutureClinicDateTime } from '../lib/time.js';
import { appointmentService } from './appointments.js';
import { notificationCoreService } from './notificationCore.js';
import { patientBillingService } from './patientBilling.js';
import { patientOnboardingService } from './patientOnboarding.js';
import { patientTimelineService } from './patientTimeline.js';

function getErrorMessage(error, fallback = 'Request failed') {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  return error.message || fallback;
}

function getUpcomingAppointments(appointments = []) {
  return appointments
    .filter((appointment) => appointment.status !== 'cancelled' && isFutureClinicDateTime(appointment.scheduled_at))
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
}

export const patientPortalService = {
  async getDashboardOverview({ user } = {}) {
    if (!user?.id) {
      return { data: null, error: 'Patient session is required.' };
    }

    const readinessResult = await patientOnboardingService.getReadiness({ userId: user.id });
    if (readinessResult.error || !readinessResult.data?.patient?.id) {
      return {
        data: null,
        error: getErrorMessage(readinessResult.error, 'Unable to load patient readiness.'),
      };
    }

    const patient = readinessResult.data.patient;
    const [appointmentsResult, notificationsResult, billingResult, timelineResult] = await Promise.all([
      appointmentService.getByPatientId(patient.id),
      notificationCoreService.getUnread(user.id),
      patientBillingService.getOverview(),
      patientTimelineService.getTimeline({ patientId: patient.id, pageSize: 6 }),
    ]);

    const appointments = appointmentsResult.error ? [] : appointmentsResult.data || [];
    const notifications = notificationsResult.error ? [] : notificationsResult.data || [];
    const billing = billingResult.error ? null : billingResult.data;
    const timeline = timelineResult.error ? null : timelineResult.data;
    const upcomingAppointments = getUpcomingAppointments(appointments);

    return {
      data: {
        user,
        patient,
        readiness: readinessResult.data,
        appointments,
        upcomingAppointments,
        nextAppointment: upcomingAppointments[0] || null,
        notifications: notifications.slice(0, 5),
        billing,
        timeline,
        warnings: {
          appointments: appointmentsResult.error || null,
          notifications: notificationsResult.error || null,
          billing: billingResult.error || null,
          timeline: timelineResult.error || null,
        },
      },
      error: null,
    };
  },
};
