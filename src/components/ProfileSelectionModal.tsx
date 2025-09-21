import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Label } from "./ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Card, CardContent } from "./ui/card";
import { Settings, Star, FolderOpen, RefreshCw } from "lucide-react";
import { api, ClaudeProfile } from "@/lib/api";
import { Toast } from "./ui/toast";

interface ProfileSelectionModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when the modal open state changes */
  onOpenChange: (open: boolean) => void;
  /** Callback when a profile is selected and confirmed */
  onProfileSelected: (profile: ClaudeProfile) => void;
  /** Optional initial selected profile ID */
  initialProfileId?: number;
  /** Optional callback to open profile management */
  onManageProfiles?: () => void;
}

export function ProfileSelectionModal({
  open,
  onOpenChange,
  onProfileSelected,
  initialProfileId,
  onManageProfiles,
}: ProfileSelectionModalProps) {
  const [profiles, setProfiles] = useState<ClaudeProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Load profiles when modal opens
  useEffect(() => {
    if (open) {
      loadProfiles();
    }
  }, [open]);

  // Set initial selection
  useEffect(() => {
    if (profiles.length > 0) {
      const defaultProfile = profiles.find(p => p.is_default);
      const initialProfile = initialProfileId ? profiles.find(p => p.id === initialProfileId) : null;
      const profileToSelect = initialProfile || defaultProfile || profiles[0];

      if (profileToSelect?.id) {
        setSelectedProfileId(profileToSelect.id.toString());
      }
    }
  }, [profiles, initialProfileId]);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      const profileList = await api.listClaudeProfiles();
      setProfiles(profileList);

      if (profileList.length === 0) {
        setToast({
          message: "Please create a Claude profile first",
          type: "error",
        });
        onOpenChange(false);
      }
    } catch (error) {
      console.error("Failed to load profiles:", error);
      setToast({
        message: "Failed to load Claude profiles",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    const selectedProfile = profiles.find(p => p.id?.toString() === selectedProfileId);
    if (selectedProfile) {
      onProfileSelected(selectedProfile);
      onOpenChange(false);
    } else {
      setToast({
        message: "Please select a profile",
        type: "error",
      });
    }
  };

  const expandPath = (path: string) => {
    if (path.startsWith("~/")) {
      return path; // Show the tilde version for user clarity
    }
    return path;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5" />
            Select Profile for New Session
          </DialogTitle>
          <DialogDescription>
            Choose which Claude configuration to use for this session
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading profiles...</span>
            </div>
          ) : profiles.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <FolderOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h4 className="text-lg font-semibold mb-2">No Profiles Found</h4>
                <p className="text-muted-foreground mb-4">
                  You need to create at least one Claude profile before starting a session
                </p>
                {onManageProfiles && (
                  <Button onClick={onManageProfiles} variant="outline">
                    <Settings className="w-4 h-4 mr-2" />
                    Manage Profiles
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              <RadioGroup value={selectedProfileId} onValueChange={setSelectedProfileId}>
                <div className="space-y-3">
                  {profiles.map((profile) => (
                    <div key={profile.id} className="flex items-start space-x-3">
                      <RadioGroupItem
                        value={profile.id?.toString() || ""}
                        id={`profile-${profile.id}`}
                        className="mt-1"
                      />
                      <Label
                        htmlFor={`profile-${profile.id}`}
                        className="flex-1 cursor-pointer"
                      >
                        <Card className="hover:bg-muted/50 transition-colors">
                          <CardContent className="p-4">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <h4 className="font-medium">{profile.name}</h4>
                                {profile.is_default && (
                                  <Badge variant="secondary" className="text-xs">
                                    <Star className="w-3 h-3 mr-1" />
                                    Default
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                <div className="font-mono text-xs bg-muted px-2 py-1 rounded">
                                  {expandPath(profile.config_directory)}
                                </div>
                              </div>
                              {profile.description && (
                                <p className="text-sm text-muted-foreground">
                                  {profile.description}
                                </p>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>

              {/* Quick Actions */}
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="text-xs text-muted-foreground">
                  {profiles.length} profile{profiles.length !== 1 ? "s" : ""} available
                </div>
                {onManageProfiles && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onManageProfiles}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Manage Profiles
                  </Button>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedProfileId || loading || profiles.length === 0}
          >
            Start Session
          </Button>
        </DialogFooter>
      </DialogContent>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </Dialog>
  );
}

// Hook for easier usage
export function useProfileSelection() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<ClaudeProfile | null>(null);

  const openProfileSelection = () => setIsOpen(true);
  const closeProfileSelection = () => setIsOpen(false);

  const handleProfileSelected = (profile: ClaudeProfile) => {
    setSelectedProfile(profile);
    setIsOpen(false);
  };

  return {
    isOpen,
    selectedProfile,
    openProfileSelection,
    closeProfileSelection,
    handleProfileSelected,
    ProfileSelectionModal: (props: Omit<ProfileSelectionModalProps, 'open' | 'onOpenChange' | 'onProfileSelected'>) => (
      <ProfileSelectionModal
        open={isOpen}
        onOpenChange={setIsOpen}
        onProfileSelected={handleProfileSelected}
        {...props}
      />
    ),
  };
}