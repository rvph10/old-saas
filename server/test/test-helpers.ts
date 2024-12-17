export const mockErrorHandlingService = {
  handleAuthenticationError: jest.fn(),
  handleValidationError: jest.fn(),
  handleDatabaseError: jest.fn(),
  handleSessionError: jest.fn(),
  handleAuthorizationError: jest.fn(),
  handleTwoFactorError: jest.fn(),
};

// Reset all mock implementations
export const resetMocks = (...mocks: jest.Mock[]) => {
  mocks.forEach((mock) => mock.mockReset());
};

// Clear all mock calls
export const clearMocks = (...mocks: jest.Mock[]) => {
  mocks.forEach((mock) => mock.mockClear());
};
