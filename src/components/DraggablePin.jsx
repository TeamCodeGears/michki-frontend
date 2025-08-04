import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import SortablePin from "./SortablePin";

function DraggablePin({ pin, index, onClick, onDelete }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: String(pin.id) });

  const style = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    transition,
    zIndex: isDragging ? 2 : 1,
  };
  return (
    <SortablePin
      pin={pin}
      index={index}
      onClick={onClick}
      onDelete={onDelete}
      listeners={listeners}
      attributes={attributes}
      setNodeRef={setNodeRef}
      style={style}
      isDragging={isDragging}
    />
  );
}

export default DraggablePin;
