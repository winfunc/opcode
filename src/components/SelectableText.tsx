import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNoteStore } from "@/hooks/useNoteStore";

interface SelectableTextProps {
  children: React.ReactNode;
  className?: string;
  source?: string; // Source identifier for the content
  onTabSwitch?: () => void; // Callback to switch to notes tab
}

export function SelectableText({ 
  children, 
  className, 
  source = "Chat Message",
  onTabSwitch 
}: SelectableTextProps) {
  const [selectedText, setSelectedText] = useState<string>("");
  const [showActions, setShowActions] = useState(false);
  const [selectionPosition, setSelectionPosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTextSelection = () => {
    const selection = window.getSelection();
    console.log('Text selection event:', { selection, text: selection?.toString() });
    
    if (selection && selection.toString().trim()) {
      const selectedString = selection.toString().trim();
      setSelectedText(selectedString);
      
      // Get selection position for floating actions
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      // Get the viewport dimensions
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const buttonWidth = 220; // Approximate width of the button container
      const buttonHeight = 60; // Approximate height of the button container
      
      // Calculate position relative to viewport
      let x = rect.left + rect.width / 2;
      let y = rect.top - buttonHeight - 15; // Position above the selection with margin
      
      // Ensure horizontal position stays within viewport bounds
      const minX = 10; // Minimum margin from left edge
      const maxX = viewportWidth - buttonWidth - 10; // Maximum position considering button width
      
      if (x - buttonWidth / 2 < minX) {
        x = minX + buttonWidth / 2;
      } else if (x - buttonWidth / 2 > maxX) {
        x = maxX + buttonWidth / 2;
      }
      
      // Ensure vertical position is visible
      const minY = 10; // Minimum margin from top
      const maxY = viewportHeight - buttonHeight - 10; // Maximum position considering button height
      
      if (y < minY) {
        // If no space above, position below the selection
        y = rect.bottom + 15;
        if (y > maxY) {
          // If still no space below, position at max allowed position
          y = maxY;
        }
      } else if (y > maxY) {
        y = maxY;
      }
      
      const position = { x, y };
      
      console.log('Setting position:', position, 'viewport:', { viewportWidth, viewportHeight }, 'selection rect:', rect);
      setSelectionPosition(position);
      setShowActions(true);
      
      // Debug: Log the state changes
      console.log('showActions set to true, selectedText:', selectedString);
    } else {
      setSelectedText("");
      setShowActions(false);
    }
  };

  const handleAddToNote = () => {
    if (!selectedText) return;
    
    console.log('Adding to note:', selectedText);
    
    try {
      const { currentNoteId, getCurrentNote, createNoteFromContent, addContentToNote } = useNoteStore.getState();
      
      console.log('Current note ID:', currentNoteId);
      
      if (currentNoteId && getCurrentNote()) {
        // Add to existing note
        console.log('Adding to existing note');
        addContentToNote(currentNoteId, selectedText, source);
      } else {
        // Create new note
        console.log('Creating new note');
        const newNote = createNoteFromContent(selectedText, source);
        console.log('Created note:', newNote);
      }
      
      // Switch to notes tab to show the result
      onTabSwitch?.();
      
      // Clear selection and hide actions
      window.getSelection()?.removeAllRanges();
      setSelectedText("");
      setShowActions(false);
    } catch (error) {
      console.error('Error adding to note:', error);
    }
  };

  const handleCreateNewNote = () => {
    if (!selectedText) return;
    
    const { createNoteFromContent } = useNoteStore.getState();
    createNoteFromContent(selectedText, source);
    
    // Switch to notes tab to show the result
    onTabSwitch?.();
    
    // Clear selection and hide actions
    window.getSelection()?.removeAllRanges();
    setSelectedText("");
    setShowActions(false);
  };

  const handleClickOutside = (e: React.MouseEvent) => {
    if (!containerRef.current?.contains(e.target as Node)) {
      setShowActions(false);
      setSelectedText("");
    }
  };

  return (
    <>
      <div
        ref={containerRef}
        className={cn("relative", className)}
        onMouseUp={handleTextSelection}
        onMouseDown={() => setShowActions(false)}
      >
        {children}
      </div>
      
      {/* Floating Action Buttons */}
      {(() => {
        console.log('Render check - showActions:', showActions, 'selectedText:', selectedText);
        return showActions && selectedText;
      })() && (
        <>
          {/* Backdrop to handle clicks outside */}
          <div
            className="fixed inset-0 bg-black/10"
            style={{ zIndex: 999998 }}
            onClick={handleClickOutside}
          />
          
          {/* Action Buttons */}
          <div
            className="fixed flex items-center gap-2 rounded-lg shadow-2xl p-3"
            style={{
              left: `${selectionPosition.x}px`,
              top: `${selectionPosition.y}px`,
              transform: 'translateX(-50%)',
              backgroundColor: '#1e293b', // Dark background
              border: '2px solid #3b82f6', // Blue border
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.05)',
              zIndex: 999999, // Very high z-index to appear above panels
              minWidth: '220px',
              maxWidth: '300px',
            }}
          >
            <Button
              size="sm"
              onClick={handleAddToNote}
              title="Add to current note or create new note"
              style={{
                height: '32px',
                padding: '0 12px',
                fontSize: '12px',
                fontWeight: '500',
                backgroundColor: '#3b82f6',
                border: 'none',
                color: 'white',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <FileText className="w-3 h-3" />
              Add to Note
            </Button>
            
            <Button
              size="sm"
              onClick={handleCreateNewNote}
              title="Create new note with this text"
              style={{
                height: '32px',
                padding: '0 12px',
                fontSize: '12px',
                fontWeight: '500',
                backgroundColor: 'transparent',
                border: '1px solid #3b82f6',
                color: '#60a5fa',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Plus className="w-3 h-3" />
              New Note
            </Button>
          </div>
        </>
      )}
    </>
  );
}