#!/bin/bash

# Admin User Creation Script for PakStream
# This script creates an admin user via the backend API

# Configuration
API_URL="http://localhost:5000/api"
ADMIN_KEY="admin123"  # Default admin key from .env

# Admin credentials to create
USERNAME="admin12"
EMAIL="sajjadaamir12@gmail.com"
PASSWORD="Admin@123"

echo "Creating admin user..."
echo "Username: $USERNAME"
echo "Email: $EMAIL"
echo ""

# Make the API request
response=$(curl -s -X POST "$API_URL/auth/register-admin" \
  -H "Content-Type: application/json" \
  -d "{
    \"username\": \"$USERNAME\",
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\",
    \"adminKey\": \"$ADMIN_KEY\"
  }")

# Check response
if echo "$response" | grep -q '"success":true'; then
  echo "✅ Admin user created successfully!"
  echo ""
  echo "Response:"
  echo "$response" | jq '.' 2>/dev/null || echo "$response"
else
  echo "❌ Failed to create admin user"
  echo ""
  echo "Response:"
  echo "$response" | jq '.' 2>/dev/null || echo "$response"
fi

echo ""
echo "You can now login with:"
echo "  Username: $USERNAME"
echo "  Password: $PASSWORD"

