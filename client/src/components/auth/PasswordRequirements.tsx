export function PasswordRequirements({ password }: { password: string }) {
    const requirements = [
      {
        label: 'At least 8 characters',
        met: password.length >= 8
      },
      {
        label: 'One uppercase letter',
        met: /[A-Z]/.test(password)
      },
      {
        label: 'One lowercase letter',
        met: /[a-z]/.test(password)
      },
      {
        label: 'One number',
        met: /\d/.test(password)
      },
      {
        label: 'One special character (@$!%*?&-)',
        met: /[@$!%*?&-]/.test(password)
      }
    ];
  
    return (
      <div className="mt-2 text-sm">
        <p className="text-gray-600 mb-1">Password requirements:</p>
        <ul className="space-y-1">
          {requirements.map(({ label, met }, index) => (
            <li
              key={index}
              className={`flex items-center ${
                met ? 'text-green-600' : 'text-gray-500'
              }`}
            >
              {met ? '✓' : '○'} {label}
            </li>
          ))}
        </ul>
      </div>
    );
  }