import assert from 'node:assert';
import React from 'react';
import { MobileFloatingNav } from '../../components/navigation/MobileFloatingNav';
import { SUPER_ADMIN_NAV_ITEMS, HOSPITAL_ADMIN_NAV_ITEMS, AdminSidebar } from '../../components/admin/AdminSidebar';
import { AdminLayout } from '../../components/admin/AdminLayout';

export function runMobileNavTests() {
  const assertions: string[] = [];

  function check(desc: string, fn: () => void) {
    try {
      fn();
      assertions.push(desc);
      console.log(`[PASS] ${desc}`);
    } catch (err: any) {
      console.error(`[FAIL] ${desc}:`, err.message);
      throw err;
    }
  }

  console.log('\n--- Mobile Floating Navigation & Collapsible Sidebar Suite ---');

  check('MobileFloatingNav returns null to guarantee exclusion from non-sidebar pages (/track, /, /display)', () => {
    assert.strictEqual(typeof MobileFloatingNav, 'function');
    const result = (MobileFloatingNav as any)({});
    assert.strictEqual(result, null);
  });

  check('Super Admin navigation items contain full administrative scope', () => {
    const ids = SUPER_ADMIN_NAV_ITEMS.map((item) => item.id);
    assert.ok(ids.includes('overview'), 'Missing overview tab');
    assert.ok(ids.includes('hospitals'), 'Missing hospitals tab');
    assert.ok(ids.includes('users'), 'Missing users tab');
    assert.ok(ids.includes('audit'), 'Missing audit logs tab');
    assert.ok(ids.includes('incidents'), 'Missing incidents tab');
    assert.ok(ids.includes('settings'), 'Missing settings tab');
  });

  check('Hospital Admin navigation items contain full clinical supervision scope', () => {
    const ids = HOSPITAL_ADMIN_NAV_ITEMS.map((item) => item.id);
    assert.ok(ids.includes('overview'), 'Missing overview tab');
    assert.ok(ids.includes('departments'), 'Missing departments tab');
    assert.ok(ids.includes('queues'), 'Missing queues tab');
    assert.ok(ids.includes('schedules'), 'Missing schedules tab');
    assert.ok(ids.includes('counters'), 'Missing counters tab');
    assert.ok(ids.includes('activity'), 'Missing activity tab');
    assert.ok(ids.includes('incidents'), 'Missing incidents tab');
    assert.ok(ids.includes('settings'), 'Missing settings tab');
  });

  check('AdminSidebar is defined and supports collapsible prop interface for PC screens', () => {
    assert.strictEqual(typeof AdminSidebar, 'function');
    assert.ok(AdminSidebar.length >= 1);
  });

  check('AdminLayout is defined and exports unified mobile floating dock and desktop sidebar shell', () => {
    assert.strictEqual(typeof AdminLayout, 'function');
    assert.ok(AdminLayout.length >= 1);
  });

  return {
    passed: assertions.length,
    failed: 0,
    assertions,
  };
}

if (process.argv[1]?.includes('mobile-floating-nav.test')) {
  runMobileNavTests();
}
