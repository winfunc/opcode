import { useState, useEffect } from "react";
import { useNoteStore } from "@/hooks/useNoteStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save, Edit3 } from "lucide-react";

export function NoteEditor() {
  const {
    getCurrentNote,
    updateNote,
  } = useNoteStore();

  const currentNote = getCurrentNote();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (currentNote) {
      setTitle(currentNote.title);
      setContent(currentNote.content);
      setHasChanges(false);
    } else {
      setTitle("");
      setContent("");
      setHasChanges(false);
    }
    setIsEditing(false);
  }, [currentNote]);

  const handleSave = () => {
    if (currentNote && hasChanges) {
      updateNote(currentNote.id, { title, content });
      setHasChanges(false);
      setIsEditing(false);
    }
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    setHasChanges(true);
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setHasChanges(true);
  };

  if (!currentNote) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-4 max-w-md">
          <Edit3 className="w-12 h-12 text-gray-400 mx-auto" />
          <h2 className="text-xl font-semibold text-gray-800">
            No note selected
          </h2>
          <p className="text-gray-600">
            Select a note from the list or create a new one to start writing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Note Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-white">
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <Input
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="font-medium"
              placeholder="Note title..."
              autoFocus
              onBlur={() => setIsEditing(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setIsEditing(false);
                }
              }}
            />
          ) : (
            <h1 
              className="text-lg font-medium text-gray-900 truncate cursor-text hover:bg-gray-50 px-2 py-1 rounded"
              onClick={() => setIsEditing(true)}
              title="Click to edit title"
            >
              {title || "Untitled Note"}
            </h1>
          )}
        </div>
        
        {hasChanges && (
          <Button
            onClick={handleSave}
            size="sm"
            className="h-8"
          >
            <Save className="w-3 h-3 mr-1.5" />
            Save
          </Button>
        )}
      </div>

      {/* Note Content */}
      <div className="flex-1 p-4">
        <textarea
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder="Start writing your note..."
          className="w-full h-full resize-none border-0 outline-none text-sm leading-relaxed bg-transparent"
          style={{ fontFamily: 'inherit' }}
        />
      </div>

      {/* Footer with metadata */}
      <div className="px-4 py-2 border-t bg-gray-50 text-xs text-gray-500 flex justify-between items-center">
        <span>
          Created: {new Date(currentNote.createdAt).toLocaleDateString()}
        </span>
        <span>
          Modified: {new Date(currentNote.updatedAt).toLocaleString()}
        </span>
      </div>
    </div>
  );
}