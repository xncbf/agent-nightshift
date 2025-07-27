#!/bin/bash

# Install test dependencies
npm install -D vitest @testing-library/react @testing-library/react-hooks @testing-library/jest-dom jsdom

echo "Test dependencies installed!"
echo ""
echo "To run tests:"
echo "  npm run test"
echo ""
echo "To run tests in watch mode:"
echo "  npm run test:watch"