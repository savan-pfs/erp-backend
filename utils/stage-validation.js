/**
 * Valid stage transitions for batches
 * Ensures proper cultivation flow progression
 */
const VALID_STAGE_TRANSITIONS = {
  'seed': ['germination', 'seedling'],
  'germination': ['seedling'],
  'seedling': ['clone', 'vegetative'],
  'clone': ['vegetative'],
  'vegetative': ['pre_flower', 'flowering'],
  'pre_flower': ['flowering'],
  'flowering': ['harvest'],
  'harvest': [] // terminal stage
};

/**
 * Map room types to batch stages
 */
const ROOM_TYPE_TO_STAGE = {
  'PROPAGATION': 'clone',
  'VEGETATIVE': 'vegetative',
  'FLOWERING': 'flowering',
  'DRYING': 'harvest',
  'CURING': 'harvest',
  'TRIMMING': 'harvest',
  'PACKAGING': 'harvest',
  'STORAGE': 'harvest',
  'PROCESSING': 'harvest',
  'QA_HOLD': 'harvest',
  'WASTE': 'harvest'
};

/**
 * Check if a stage transition is valid
 */
function isValidStageTransition(fromStage, toStage) {
  if (!fromStage || !toStage) {
    return false;
  }

  // Same stage is always valid (no-op)
  if (fromStage === toStage) {
    return true;
  }

  const allowedTransitions = VALID_STAGE_TRANSITIONS[fromStage] || [];
  return allowedTransitions.includes(toStage);
}

/**
 * Get the stage that corresponds to a room type
 */
function getStageForRoomType(roomType) {
  return ROOM_TYPE_TO_STAGE[roomType] || null;
}

/**
 * Get allowed stage transitions from a given stage
 */
function getAllowedStageTransitions(fromStage) {
  return VALID_STAGE_TRANSITIONS[fromStage] || [];
}

/**
 * Validate that a room type transition results in a valid stage transition
 */
function validateRoomToStageTransition(currentStage, fromRoomType, toRoomType) {
  const toStage = getStageForRoomType(toRoomType);
  
  if (!toStage) {
    return { valid: false, error: `Room type ${toRoomType} does not map to a valid stage` };
  }

  if (!isValidStageTransition(currentStage, toStage)) {
    const allowed = getAllowedStageTransitions(currentStage);
    return {
      valid: false,
      error: `Invalid stage transition from ${currentStage} to ${toStage}. Allowed transitions: ${allowed.join(', ') || 'none'}`
    };
  }

  return { valid: true, newStage: toStage };
}

module.exports = {
  isValidStageTransition,
  getStageForRoomType,
  getAllowedStageTransitions,
  validateRoomToStageTransition,
  VALID_STAGE_TRANSITIONS,
  ROOM_TYPE_TO_STAGE
};
