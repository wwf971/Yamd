# Design guidance for Custom Component

### Critical requirements
- Must use forwardRef and expose calcBulletYPos method
- Must subscribe to keyboardCounter (not React onKeyDown)
- Must call setCurrentSegId on mouse down and programmatic focus
- Must handle focus types: arrowUp, arrowDown, arrowUpFromFirstChild, fromLeft, fromRight
- Must use useUpdateEffect to skip initial keyboard counter

### Example component outline
```jsx
const CustomNode = forwardRef(({ nodeId, nodeData, nodeState, parentInfo, globalInfo }, ref) => {
  const renderUtils = useRenderUtilsContext()
  const contentRef = useRef(null)

  // Expose calcBulletYPos for bullet positioning
  useImperativeHandle(ref, () => ({
    calcBulletYPos: (containerClassName) => {
      // return { code: 0, message: 'Success', data: bulletYPos }
    }
  }), [])

  // Handle keyboard events (forwarded from YamdDoc, not React onKeyDown)
  const handleKeyDown = useCallback((event) => {
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      renderUtils.triggerUnfocus(nodeId, nodeId, 'up', { cursorPageX: 0 })
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      renderUtils.triggerUnfocus(nodeId, nodeId, 'down', { cursorPageX: 0 })
    }
  }, [nodeId, renderUtils])
  
  // Subscribe to keyboard counter (skip initial mount)
  const keyboardCounter = renderUtils.useNodeKeyboardCounter?.(nodeId) || 0
  useUpdateEffect(() => {
    const data = renderUtils.getNodeDataById?.(nodeId)
    if (keyboardCounter === data?.lastProcessedKeyboardCounter) return
    
    const state = renderUtils.getNodeStateById?.(nodeId)
    if (!state?.keyboard?.event) return
    
    renderUtils.updateNodeData(nodeId, (draft) => {
      draft.lastProcessedKeyboardCounter = keyboardCounter
    })
    handleKeyDown(state.keyboard.event)
  }, [keyboardCounter, nodeId, renderUtils, handleKeyDown])

  // Handle programmatic focus
  const handleProgramaticFocus = useCallback((state) => {
    if (!state?.focus || state.focus.counter <= state.focus.counterProcessed) return
    
    renderUtils.cancelCurrentSegId?.()
    renderUtils.setCurrentSegId?.(nodeId)
    
    requestAnimationFrame(() => {
      contentRef.current?.focus?.()
      const { type, cursorPageX } = state.focus
      // Handle: 'fromLeft', 'fromRight', 'arrowUp', 'arrowDown', 'arrowUpFromFirstChild'
    })
    renderUtils.markFocusProcessed?.(nodeId)
  }, [nodeId, renderUtils])

  useEffect(() => {
    handleProgramaticFocus(nodeState)
  }, [nodeState?.focus?.counter, handleProgramaticFocus])

  // Handle programmatic unfocus
  const handleProgramaticUnfocus = useCallback((state) => {
    if (!state?.unfocus || state.unfocus.counter <= state.unfocus.counterProcessed) return
    
    const { type, cursorPageX } = state.unfocus
    renderUtils.markUnfocusProcessed?.(nodeId)
    
    if (type === 'up') {
      const upTargetId = getMoveUpTargetId(nodeId, renderUtils.getNodeDataById)
      if (upTargetId) renderUtils.triggerFocus(upTargetId, 'arrowUp', { cursorPageX })
    }
    if (type === 'down') {
      const downTargetId = getMoveDownTargetId(nodeId, renderUtils.getNodeDataById)
      if (downTargetId) renderUtils.triggerFocus(downTargetId, 'arrowDown', { cursorPageX })
    }
  }, [nodeId, renderUtils])

  useEffect(() => {
    handleProgramaticUnfocus(nodeState)
  }, [nodeState?.unfocus?.counter, handleProgramaticUnfocus])

  // Handle mouse down - register as current segment
  const handleMouseDown = (event) => {
    if (!renderUtils.isEditable) return
    event.stopPropagation()
    renderUtils.setCurrentSegId?.(nodeId)
    contentRef.current?.focus?.()
  }

  return (
    <div onMouseDown={handleMouseDown}>
      <div ref={contentRef} contentEditable={renderUtils.isEditable}>
        {nodeData.textRaw}
      </div>
    </div>
  )
})
```

### Responding to bullet y position requests

The component should expose calcBulletYPos through useImperativeHandle. Example:

```jsx
useImperativeHandle(ref, () => ({
  calcBulletYPos: (containerClassName) => {
    // compute preferred y position relative to container
    // ...
    return { code: 0, message: 'Success', data: yPos }
  }
}), [])
```

### How to register custom components

Register custom components in customCompStore. Example:

```jsx
registerCustomComp('box', CustomNodeExample)
```

### How YamdDoc receives components

Provide getCustomComp to YamdDoc. Example:

```jsx
<YamdDoc getCustomComp={getCustomComp} />
```