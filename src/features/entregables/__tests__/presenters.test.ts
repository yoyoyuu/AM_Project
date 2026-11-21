import {
  getClientDeliverableView,
  canArtistUploadDeliverable,
  formatFileSize,
} from '../presenters';

// ── getClientDeliverableView ──────────────────────────────────────────────────

describe('getClientDeliverableView', () => {
  it('returns NOT_UPLOADED when deliverable_path is null', () => {
    expect(
      getClientDeliverableView({ deliverable_path: null, payment_status: 'VERIFIED' }),
    ).toBe('NOT_UPLOADED');
  });

  it('returns UNLOCKED when path set and payment VERIFIED', () => {
    expect(
      getClientDeliverableView({
        deliverable_path: 'comm-1/final-abc.jpg',
        payment_status: 'VERIFIED',
      }),
    ).toBe('UNLOCKED');
  });

  it('returns LOCKED when path set and payment UNPAID', () => {
    expect(
      getClientDeliverableView({
        deliverable_path: 'comm-1/final-abc.jpg',
        payment_status: 'UNPAID',
      }),
    ).toBe('LOCKED');
  });

  it('returns LOCKED when path set and payment UNDER_REVIEW', () => {
    expect(
      getClientDeliverableView({
        deliverable_path: 'comm-1/final-abc.jpg',
        payment_status: 'UNDER_REVIEW',
      }),
    ).toBe('LOCKED');
  });

  it('returns LOCKED when path set and payment NEEDS_CORRECTION', () => {
    expect(
      getClientDeliverableView({
        deliverable_path: 'comm-1/final-abc.jpg',
        payment_status: 'NEEDS_CORRECTION',
      }),
    ).toBe('LOCKED');
  });
});

// ── canArtistUploadDeliverable ────────────────────────────────────────────────

describe('canArtistUploadDeliverable', () => {
  it('EN_PROGRESO + FINAL → true', () => {
    expect(canArtistUploadDeliverable({ status: 'EN_PROGRESO', current_stage: 'FINAL' })).toBe(true);
  });

  it('EN_PROGRESO + SKETCH → false', () => {
    expect(canArtistUploadDeliverable({ status: 'EN_PROGRESO', current_stage: 'SKETCH' })).toBe(false);
  });

  it('EN_PROGRESO + LINEART → false', () => {
    expect(canArtistUploadDeliverable({ status: 'EN_PROGRESO', current_stage: 'LINEART' })).toBe(false);
  });

  it('EN_PROGRESO + null stage → false', () => {
    expect(canArtistUploadDeliverable({ status: 'EN_PROGRESO', current_stage: null })).toBe(false);
  });

  it('COMPLETADA + FINAL → false', () => {
    expect(canArtistUploadDeliverable({ status: 'COMPLETADA', current_stage: 'FINAL' })).toBe(false);
  });
});

// ── formatFileSize ────────────────────────────────────────────────────────────

describe('formatFileSize', () => {
  it('formats bytes below 1 MB as KB', () => {
    expect(formatFileSize(500_000)).toBe('488 KB');
  });

  it('formats exactly 1 MB', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
  });

  it('formats 2.5 MB', () => {
    expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
  });

  it('formats small bytes as KB rounded', () => {
    const result = formatFileSize(1024);
    expect(result).toBe('1 KB');
  });
});
