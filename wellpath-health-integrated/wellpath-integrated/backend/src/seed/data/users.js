const ageOn = (birthday, asOf = '2026-07-14') => {
  const birthDate = new Date(`${birthday}T00:00:00Z`);
  const currentDate = new Date(`${asOf}T00:00:00Z`);
  let age = currentDate.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDiff = currentDate.getUTCMonth() - birthDate.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && currentDate.getUTCDate() < birthDate.getUTCDate())) {
    age -= 1;
  }
  return age;
};

const profile = ({ date_of_birth, ...rest }) => ({
  ...rest,
  date_of_birth,
  birthday: date_of_birth,
  age: ageOn(date_of_birth),
});

export const users = [
  { user_id: 1, role_id: 1, account_status: 'active' },
  { user_id: 2, role_id: 1, account_status: 'active' },
  { user_id: 3, role_id: 1, account_status: 'active' },
  { user_id: 4, role_id: 1, account_status: 'active' },
  { user_id: 5, role_id: 1, account_status: 'active' },
  { user_id: 6, role_id: 2, account_status: 'active' },
  { user_id: 7, role_id: 3, account_status: 'active' },
  { user_id: 8, role_id: 1, account_status: 'active' },
];

export const userPii = [
  profile({ user_id: 1, full_name: 'Alex Johnson', date_of_birth: '2002-04-12', height_inches: 70, weight_lbs: 164, gender: 'Male', email: 'alex@example.com' }),      // BMI ~23.5
  profile({ user_id: 2, full_name: 'Maria Garcia', date_of_birth: '1998-08-25', height_inches: 64, weight_lbs: 184, gender: 'Female', email: 'maria@example.com' }),    // BMI ~31.6 (obese)
  profile({ user_id: 3, full_name: 'James Kim', date_of_birth: '1995-11-03', height_inches: 69, weight_lbs: 180, gender: 'Male', email: 'james@example.com' }),         // BMI ~26.6
  profile({ user_id: 4, full_name: 'Sophie Patel', date_of_birth: '2000-06-18', height_inches: 65, weight_lbs: 150, gender: 'Female', email: 'sophie@example.com' }),   // BMI ~25.0
  profile({ user_id: 5, full_name: 'Daniel Lee', date_of_birth: '1997-09-30', height_inches: 70, weight_lbs: 181, gender: 'Male', email: 'daniel@example.com' }),       // BMI ~26.0
  profile({ user_id: 6, full_name: 'Jordan Lee', date_of_birth: '1990-03-15', height_inches: 68, weight_lbs: 170, gender: 'Non-binary', email: 'jordan@example.com' }),
  profile({ user_id: 7, full_name: 'Dr. Rivera', date_of_birth: '1985-07-22', height_inches: 66, weight_lbs: 145, gender: 'Female', email: 'rivera@example.com' }),
  profile({ user_id: 8, full_name: 'Robert Hayes', date_of_birth: '1964-03-10', height_inches: 69, weight_lbs: 224, gender: 'Male', email: 'robert@example.com' }), // 62, BMI ~33 — the at-risk profile
];
