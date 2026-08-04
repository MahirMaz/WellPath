import React from 'react';

export function PatientAppHeader({ patientData, aiEnabled }) {
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
        <div className="mini-avatar">
          {patientData.name.split(' ').map((part) => part[0]).join('')}
        </div>
      </div>
    </header>
  );
}