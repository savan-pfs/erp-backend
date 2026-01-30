const { query } = require('../config/database');

/**
 * Valid room type transitions
 * Defines which room types can transition to which other room types
 */
const VALID_ROOM_TRANSITIONS = {
  PROPAGATION: ['VEGETATIVE', 'WASTE'],
  VEGETATIVE: ['FLOWERING', 'WASTE'],
  FLOWERING: ['DRYING', 'WASTE'],
  DRYING: ['CURING', 'TRIMMING', 'WASTE'],
  CURING: ['TRIMMING', 'PACKAGING', 'STORAGE', 'WASTE'],
  TRIMMING: ['PACKAGING', 'STORAGE', 'WASTE'],
  PACKAGING: ['STORAGE', 'QA_HOLD', 'WASTE'],
  PROCESSING: ['PACKAGING', 'STORAGE', 'QA_HOLD', 'WASTE'],
  STORAGE: ['PACKAGING', 'PROCESSING', 'WASTE'],
  QA_HOLD: ['STORAGE', 'PACKAGING', 'WASTE'],
  WASTE: [] // WASTE is terminal
};

/**
 * Allowed operations per room type
 */
const ROOM_TYPE_OPERATIONS = {
  PROPAGATION: ['create_plant', 'germinate', 'clone', 'view'],
  VEGETATIVE: ['move_plant', 'feed', 'water', 'transplant', 'view'],
  FLOWERING: ['move_plant', 'feed', 'water', 'harvest', 'view'],
  DRYING: ['move_harvest', 'monitor', 'view'],
  CURING: ['move_harvest', 'monitor', 'view'],
  TRIMMING: ['trim', 'move_batch', 'view'],
  PACKAGING: ['package', 'label', 'move_batch', 'view'],
  PROCESSING: ['manufacture', 'extract', 'move_batch', 'view'],
  STORAGE: ['store', 'retrieve', 'move_batch', 'view'],
  QA_HOLD: ['hold', 'release', 'view'],
  WASTE: ['destroy', 'dispose', 'view']
};

/**
 * Check if a room type transition is valid
 */
function isValidRoomTransition(fromRoomType, toRoomType) {
  if (!fromRoomType || !toRoomType) {
    return false;
  }

  // Same room type is always valid (no-op)
  if (fromRoomType === toRoomType) {
    return true;
  }

  const allowedTransitions = VALID_ROOM_TRANSITIONS[fromRoomType] || [];
  return allowedTransitions.includes(toRoomType);
}

/**
 * Check if an operation is allowed in a room type
 */
function isOperationAllowed(roomType, operation) {
  if (!roomType || !operation) {
    return false;
  }

  const allowedOperations = ROOM_TYPE_OPERATIONS[roomType] || [];
  return allowedOperations.includes(operation);
}

/**
 * Validate room type for plant operation
 */
async function validateRoomForPlantOperation(roomId, operation) {
  try {
    const result = await query(`
      SELECT room_type FROM rooms WHERE id = $1 AND is_active = true
    `, [roomId]);

    if (result.rows.length === 0) {
      return { valid: false, error: 'Room not found or inactive' };
    }

    const roomType = result.rows[0].room_type;
    const allowed = isOperationAllowed(roomType, operation);

    if (!allowed) {
      return {
        valid: false,
        error: `Operation '${operation}' is not allowed in ${roomType} room`
      };
    }

    return { valid: true, roomType };
  } catch (error) {
    console.error('Error validating room:', error);
    return { valid: false, error: 'Room validation failed' };
  }
}

/**
 * Validate room transition for plant
 */
async function validatePlantRoomTransition(plantId, fromRoomId, toRoomId) {
  try {
    // Get room types
    const roomsResult = await query(`
      SELECT r1.room_type as from_type, r2.room_type as to_type
      FROM rooms r1, rooms r2
      WHERE r1.id = $1 AND r2.id = $2
    `, [fromRoomId, toRoomId]);

    if (roomsResult.rows.length === 0) {
      return { valid: false, error: 'One or both rooms not found' };
    }

    const { from_type, to_type } = roomsResult.rows[0];

    if (!isValidRoomTransition(from_type, to_type)) {
      return {
        valid: false,
        error: `Invalid room transition from ${from_type} to ${to_type}`
      };
    }

    return { valid: true, fromType: from_type, toType: to_type };
  } catch (error) {
    console.error('Error validating room transition:', error);
    return { valid: false, error: 'Room transition validation failed' };
  }
}

/**
 * Get allowed room types for transition from a given room type
 */
function getAllowedRoomTransitions(fromRoomType) {
  return VALID_ROOM_TRANSITIONS[fromRoomType] || [];
}

/**
 * Get allowed operations for a room type
 */
function getAllowedOperations(roomType) {
  return ROOM_TYPE_OPERATIONS[roomType] || [];
}

module.exports = {
  isValidRoomTransition,
  isOperationAllowed,
  validateRoomForPlantOperation,
  validatePlantRoomTransition,
  getAllowedRoomTransitions,
  getAllowedOperations,
  VALID_ROOM_TRANSITIONS,
  ROOM_TYPE_OPERATIONS
};
