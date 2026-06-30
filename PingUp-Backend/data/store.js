const bcrypt = require('bcryptjs');

const ROLES = {
  ADMIN: 'owner',
  MODERATOR: 'moderator',
  MEMBER: 'member',
};

const ROLE_WEIGHTS = {
  [ROLES.ADMIN]: 3,
  [ROLES.MODERATOR]: 2,
  [ROLES.MEMBER]: 1,
};

const hasPermission = (userRole, requiredRole) => {
  const userWeight = ROLE_WEIGHTS[userRole] || 0;
  const requiredWeight = ROLE_WEIGHTS[requiredRole] || 0;

  return userWeight >= requiredWeight;
}

const PERMISSIONS = {
  admin: ['send_message', 'create_room', 'delete_room', 'kick_user', 'promote_user', 'delete_message'],
  moderator: ['send_message', 'create_room', 'kick_user', 'delete_message'],
  member: ['send_message'],
};


module.exports = {
  ROLES,
  ROLE_WEIGHTS,
  PERMISSIONS,
  hasPermission
};
