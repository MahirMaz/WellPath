import React from 'react';
import { Settings } from 'lucide-react';

export function PatientAppHeader({ patientData, aiEnabled, onOpenSettings }) {
  return (
    <header className="patient-app-header">
      <div>
        <span>WellPath</span>
        <strong>Hi, {patientData.name.split(' ')[0]}</strong>
      </div>
      <div className="patient-header-actions">
        <span className={aiEnabled ? 'ai-status on' : 'ai-status off'}>
          {aiEnabled ? 'AI on' : 'AI off'}
        </span>
        <button
          type="button"
          className="header-settings-btn"
          onClick={onOpenSettings}
          aria-label="Settings"
        >
          <Settings size={19} />
        </button>
      </div>
    </header>
  );
}
