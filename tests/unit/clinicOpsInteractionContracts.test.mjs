import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getClinicOpsAppointmentTarget,
  getClinicOpsNotificationTarget,
  getClinicOpsPatientTarget,
  getClinicOpsSearchTarget,
  isUnreadNotification,
  normalizeClinicOpsAppointmentView,
} from '../../packages/core/lib/clinicOpsNavigation.js';
import {
  getAppointmentAllowedActions,
  normalizeAppointmentViewModel,
} from '../../packages/core/lib/clinicOpsAppointments.js';
import { formatBillingReference } from '../../packages/core/lib/billingReference.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function readRepoFile(relativePath) {
  return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

function collectSourceFiles(relativeDir) {
  const absoluteDir = resolve(ROOT, relativeDir);
  const files = [];
  for (const entry of readdirSync(absoluteDir)) {
    const absolutePath = resolve(absoluteDir, entry);
    const stat = statSync(absolutePath);
    if (stat.isDirectory()) {
      files.push(...collectSourceFiles(`${relativeDir}/${entry}`));
    } else if (/\.(jsx?|tsx?)$/.test(entry)) {
      files.push(`${relativeDir}/${entry}`);
    }
  }
  return files;
}

describe('clinic-ops navigation contracts', () => {
  it('routes role-aware appointment notifications to real appointment screens', () => {
    assert.equal(
      getClinicOpsNotificationTarget({ related_type: 'appointment', related_id: 'appt-1' }, 'doctor'),
      '/doctor-appointments?view=day&appointmentId=appt-1'
    );
    assert.equal(
      getClinicOpsNotificationTarget({ type: 'precheck', related_id: 'appt-2' }, 'predoctor'),
      '/predoctor-appointments?view=day&appointmentId=appt-2'
    );
    assert.equal(
      getClinicOpsAppointmentTarget('appt-3', 'secretary', { date: '2026-05-18' }),
      '/appointments?view=day&date=2026-05-18&appointmentId=appt-3'
    );
  });

  it('normalizes legacy appointment view names to the canonical URL contract', () => {
    assert.equal(normalizeClinicOpsAppointmentView('daily'), 'day');
    assert.equal(normalizeClinicOpsAppointmentView('weekly'), 'week');
    assert.equal(normalizeClinicOpsAppointmentView('monthly'), 'month');
    assert.equal(getClinicOpsAppointmentTarget('appt-4', 'doctor', { view: 'weekly' }), '/doctor-appointments?view=week&appointmentId=appt-4');
  });

  it('routes patient/search/message/report actions without fake placeholders', () => {
    assert.equal(getClinicOpsPatientTarget('patient-1', 'doctor'), '/doctor-patient/patient-1');
    assert.equal(getClinicOpsPatientTarget('patient-1', 'secretary'), '/patient-profile/patient-1');
    assert.equal(getClinicOpsSearchTarget('  assad  ', 'doctor'), '/doctor-patients?q=assad');
    assert.equal(
      getClinicOpsNotificationTarget({ related_type: 'conversation', related_id: 'conv-1' }, 'secretary'),
      '/staff-messages?conversationId=conv-1'
    );
    assert.equal(
      getClinicOpsNotificationTarget({ related_type: 'analytical_report', related_id: 'report-1' }, 'doctor'),
      '/reports/report-1'
    );
  });

  it('computes unread state from both inbox shapes', () => {
    assert.equal(isUnreadNotification({ is_read: false }), true);
    assert.equal(isUnreadNotification({ is_read: true }), false);
    assert.equal(isUnreadNotification({ read_at: null }), true);
    assert.equal(isUnreadNotification({ read_at: '2026-05-18T00:00:00Z' }), false);
  });
});

describe('clinic-ops appointment view models', () => {
  const appointment = {
    id: 'appt-1',
    patient_id: 'patient-1',
    doctor_id: 'doctor-1',
    clinic_id: 'clinic-1',
    slot_id: 'slot-1',
    scheduled_at: '2026-05-18T09:30:00Z',
    status: 'confirmed',
    reason: 'Follow-up',
    duration_minutes: 45,
    patients: { users: { first_name: 'Maya', last_name: 'Haddad' } },
    doctors: { users: { first_name: 'Sami', last_name: 'Halabi' } },
    clinics: { name: 'Main Clinic', room: 'Exam 2' },
  };

  it('normalizes appointment records into the shared clinic-ops UI shape', () => {
    const viewModel = normalizeAppointmentViewModel(appointment, { role: 'doctor' });

    assert.equal(viewModel.id, 'appt-1');
    assert.equal(viewModel.patient.name, 'Maya Haddad');
    assert.equal(viewModel.doctor.name, 'Sami Halabi');
    assert.equal(viewModel.clinic.label, 'Main Clinic · Exam 2');
    assert.equal(viewModel.reason, 'Follow-up');
    assert.equal(viewModel.duration, 45);
    assert.equal(viewModel.status, 'confirmed');
    assert.equal(viewModel.allowedActions.openEncounter.enabled, true);
  });

  it('does not allow encounter or cancellation actions for terminal appointments', () => {
    const actions = getAppointmentAllowedActions({ ...appointment, status: 'completed' }, { role: 'doctor' });

    assert.equal(actions.openEncounter.enabled, false);
    assert.match(actions.openEncounter.reason, /completed/i);
    assert.equal(actions.cancel.enabled, false);
    assert.match(actions.cancel.reason, /terminal/i);
  });
});

describe('clinic-ops fake UI canaries', () => {
  const scopedFiles = [
    'apps/clinic-ops/src/pages/AppointmentsPage.jsx',
    'apps/clinic-ops/src/components/appointments/calendar/MonthView.jsx',
    'apps/clinic-ops/src/components/appointments/calendar/WeekView.jsx',
    'apps/clinic-ops/src/components/appointments/calendar/DayView.jsx',
    'apps/clinic-ops/src/components/appointments/TodayScheduleSidebar.jsx',
    'apps/clinic-ops/src/pages/DoctorDashboardPage.jsx',
    'apps/clinic-ops/src/pages/DoctorAppointmentsPage.jsx',
    'apps/clinic-ops/src/components/doctor/DoctorDailyView.jsx',
    'apps/clinic-ops/src/components/doctor/DoctorWeeklyView.jsx',
    'apps/clinic-ops/src/components/doctor/DoctorMonthlyView.jsx',
    'apps/clinic-ops/src/pages/PreDoctorCheckPage.jsx',
    'apps/clinic-ops/src/components/dashboard/PreDoctorQueueList.jsx',
    'apps/clinic-ops/src/components/dashboard/DashboardHeader.jsx',
    'apps/clinic-ops/src/pages/CreateBillPage.jsx',
  ];

  it('blocks browser alert placeholders in clinic-ops source files', () => {
    for (const file of collectSourceFiles('apps/clinic-ops/src')) {
      assert.doesNotMatch(readRepoFile(file), /\balert\s*\(/, `${file} must not use alert() as UX`);
    }
  });

  it('blocks browser confirm traps in clinic-ops source files', () => {
    for (const file of collectSourceFiles('apps/clinic-ops/src')) {
      assert.doesNotMatch(readRepoFile(file), /\bwindow\.confirm\s*\(|\bconfirm\s*\(/, `${file} must use an app-owned confirmation dialog`);
    }
  });

  it('blocks fake opening/connecting toast copy in repaired workflow files', () => {
    for (const file of scopedFiles) {
      assert.doesNotMatch(readRepoFile(file), /showToast\(['"`](Opening|Connecting)\b/, `${file} must wire actions instead of fake toast copy`);
    }
  });

  it('blocks hardcoded billing and unfinished workflow copy in clinic-ops source files', () => {
    const joined = collectSourceFiles('apps/clinic-ops/src').map(readRepoFile).join('\n');
    for (const token of [
      'INV-8842',
      'INV-88241',
      'feature coming soon',
      'Password reset link sent',
      '2FA settings opened',
      'Active sessions view opened',
      'generated and downloaded',
      'By tomorrow, 09:00 AM',
      'Download PDF',
      'Scan to verify',
      'Scan to verify document integrity',
      'HIPAA Compliant Infrastructure',
    ]) {
      assert.equal(joined.includes(token), false, `clinic-ops source must not contain fake workflow token: ${token}`);
    }
  });

  it('blocks client-generated business reference numbers in clinic-ops source files', () => {
    for (const file of collectSourceFiles('apps/clinic-ops/src')) {
      assert.doesNotMatch(
        readRepoFile(file),
        /Date\.now\(\)\.toString\(\)\.slice\(/,
        `${file} must use persisted record ids for business references`
      );
    }
  });

  it('blocks stale demo calendar content in doctor appointment views', () => {
    const joined = [
      readRepoFile('apps/clinic-ops/src/pages/DoctorAppointmentsPage.jsx'),
      readRepoFile('apps/clinic-ops/src/components/doctor/DoctorDailyView.jsx'),
      readRepoFile('apps/clinic-ops/src/components/doctor/DoctorWeeklyView.jsx'),
    ].join('\n');

    for (const token of ['October 2023', 'Robert Vance', 'Lucy Graham', '148 Total Appointments', '24 / 30']) {
      assert.equal(joined.includes(token), false, `doctor appointments must not contain stale demo token: ${token}`);
    }
  });

  it('keeps the doctor report builder away from bulk patient dropdowns and fake document affordances', () => {
    const source = readRepoFile('apps/clinic-ops/src/pages/DoctorReportsPage.jsx');

    assert.doesNotMatch(source, /usePatients\(/, 'doctor reports must search/select one patient explicitly instead of loading every patient');
    assert.doesNotMatch(source, /<select[\s\S]*patients\.map/, 'doctor reports must not render every patient in a dropdown');
    for (const token of ['Draw Signature Here', 'Export unavailable', 'Signature Stamp', 'Comprehensive Medical Report']) {
      assert.equal(source.includes(token), false, `doctor reports must not contain old fake report-builder token: ${token}`);
    }
  });
});

describe('billing references', () => {
  it('formats posted payment references from persisted payment ids only', () => {
    assert.equal(formatBillingReference(null), 'Pending server reference');
    assert.equal(formatBillingReference({ id: '123e4567-e89b-12d3-a456-426614174000' }), 'PAY-123E4567E89B');
    assert.equal(formatBillingReference({ client_request_id: 'billing-post-2026-05-18' }), 'PAY-BILLINGPOST2');
  });
});
