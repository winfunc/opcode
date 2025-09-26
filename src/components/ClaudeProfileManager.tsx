import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Checkbox } from "./ui/checkbox";
import { Plus, Edit3, Trash2, FolderOpen, Star } from "lucide-react";
import { api, ClaudeProfile, CreateProfileRequest } from "@/lib/api";
import { Toast } from "./ui/toast";

interface ClaudeProfileManagerProps {
  className?: string;
}

export function ClaudeProfileManager({ className }: ClaudeProfileManagerProps) {
  const [profiles, setProfiles] = useState<ClaudeProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ClaudeProfile | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [profileToDelete, setProfileToDelete] = useState<ClaudeProfile | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Form state
  const [formData, setFormData] = useState<CreateProfileRequest>({
    name: "",
    config_directory: "",
    description: "",
    is_default: false,
  });

  // Load profiles on component mount
  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      const profileList = await api.listClaudeProfiles();
      setProfiles(profileList);
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

  const resetForm = () => {
    setFormData({
      name: "",
      config_directory: "",
      description: "",
      is_default: false,
    });
  };

  const handleCreateProfile = async () => {
    try {
      if (!formData.name.trim()) {
        setToast({
          message: "Profile name is required",
          type: "error",
        });
        return;
      }

      if (!formData.config_directory.trim()) {
        setToast({
          message: "Configuration directory is required",
          type: "error",
        });
        return;
      }

      // Validate directory path
      await api.validateProfileDirectory(formData.config_directory);

      const newProfile = await api.createClaudeProfile(formData);
      setProfiles(prev => [...prev, newProfile]);
      setIsCreateDialogOpen(false);
      resetForm();

      setToast({
        message: "Profile created successfully",
        type: "success",
      });
    } catch (error: any) {
      console.error("Failed to create profile:", error);
      setToast({
        message: error.message || "Failed to create profile",
        type: "error",
      });
    }
  };

  const handleEditProfile = async () => {
    if (!editingProfile?.id) return;

    try {
      if (!formData.name.trim()) {
        setToast({
          message: "Profile name is required",
          type: "error",
        });
        return;
      }

      if (!formData.config_directory.trim()) {
        setToast({
          message: "Configuration directory is required",
          type: "error",
        });
        return;
      }

      // Validate directory path
      await api.validateProfileDirectory(formData.config_directory);

      const updatedProfile = await api.updateClaudeProfile(editingProfile.id, formData);
      setProfiles(prev => prev.map(p => p.id === editingProfile.id ? updatedProfile : p));
      setEditingProfile(null);
      resetForm();

      setToast({
        message: "Profile updated successfully",
        type: "success",
      });
    } catch (error: any) {
      console.error("Failed to update profile:", error);
      setToast({
        message: error.message || "Failed to update profile",
        type: "error",
      });
    }
  };

  const handleDeleteProfile = async () => {
    if (!profileToDelete?.id) return;

    try {
      await api.deleteClaudeProfile(profileToDelete.id);
      setProfiles(prev => prev.filter(p => p.id !== profileToDelete.id));
      setProfileToDelete(null);
      setShowDeleteDialog(false);

      setToast({
        message: "Profile deleted successfully",
        type: "success",
      });

      // Reload profiles to ensure default profile is correctly set
      loadProfiles();
    } catch (error: any) {
      console.error("Failed to delete profile:", error);
      setToast({
        message: error.message || "Failed to delete profile",
        type: "error",
      });
    }
  };

  const openDeleteDialog = (profile: ClaudeProfile) => {
    setProfileToDelete(profile);
    setShowDeleteDialog(true);
  };

  const handleSetDefault = async (profile: ClaudeProfile) => {
    if (!profile.id) return;

    try {
      await api.setDefaultProfile(profile.id);
      setProfiles(prev => prev.map(p => ({
        ...p,
        is_default: p.id === profile.id
      })));

      setToast({
        message: `"${profile.name}" is now the default profile`,
        type: "success",
      });
    } catch (error: any) {
      console.error("Failed to set default profile:", error);
      setToast({
        message: error.message || "Failed to set default profile",
        type: "error",
      });
    }
  };

  const openEditDialog = (profile: ClaudeProfile) => {
    setEditingProfile(profile);
    setFormData({
      name: profile.name,
      config_directory: profile.config_directory,
      description: profile.description || "",
      is_default: profile.is_default,
    });
  };

  const expandPath = (path: string) => {
    if (path.startsWith("~/")) {
      return path; // Show the tilde version for user clarity
    }
    return path;
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className || ""}`}>
        <div className="text-muted-foreground">Loading profiles...</div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className || ""}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Claude Profiles</h3>
          <p className="text-sm text-muted-foreground">
            Manage different Claude Code configuration directories
          </p>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              Add Profile
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Profile</DialogTitle>
              <DialogDescription>
                Add a new Claude configuration profile
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="create-name">Name</Label>
                <Input
                  id="create-name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Personal, Work, Client-A"
                />
              </div>
              <div>
                <Label htmlFor="create-directory">Configuration Directory</Label>
                <Input
                  id="create-directory"
                  value={formData.config_directory}
                  onChange={(e) => setFormData(prev => ({ ...prev, config_directory: e.target.value }))}
                  placeholder="e.g., ~/.claude-work"
                />
              </div>
              <div>
                <Label htmlFor="create-description">Description (Optional)</Label>
                <Textarea
                  id="create-description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of this profile..."
                  rows={2}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="create-default"
                  checked={formData.is_default}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_default: !!checked }))}
                />
                <Label htmlFor="create-default">Set as default profile</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateProfile}>
                Create Profile
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Profile List */}
      <div className="grid gap-4">
        {profiles.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <FolderOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h4 className="text-lg font-semibold mb-2">No Profiles Found</h4>
              <p className="text-muted-foreground mb-4">
                Create your first Claude profile to get started
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Profile
              </Button>
            </CardContent>
          </Card>
        ) : (
          profiles.map((profile) => (
            <Card key={profile.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{profile.name}</CardTitle>
                    {profile.is_default && (
                      <Badge variant="secondary" className="text-xs">
                        <Star className="w-3 h-3 mr-1" />
                        Default
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(profile)}
                    >
                      <Edit3 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openDeleteDialog(profile)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Directory:</span>{" "}
                    <code className="text-xs bg-muted px-1 py-0.5 rounded">
                      {expandPath(profile.config_directory)}
                    </code>
                  </div>
                  {profile.description && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Description:</span>{" "}
                      {profile.description}
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2">
                    <div className="text-xs text-muted-foreground">
                      Created {new Date(profile.created_at).toLocaleDateString()}
                    </div>
                    {!profile.is_default && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetDefault(profile)}
                      >
                        <Star className="w-3 h-3 mr-1" />
                        Set Default
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit Profile Dialog */}
      <Dialog open={!!editingProfile} onOpenChange={(open) => !open && setEditingProfile(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>
              Update the profile configuration
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Personal, Work, Client-A"
              />
            </div>
            <div>
              <Label htmlFor="edit-directory">Configuration Directory</Label>
              <Input
                id="edit-directory"
                value={formData.config_directory}
                onChange={(e) => setFormData(prev => ({ ...prev, config_directory: e.target.value }))}
                placeholder="e.g., ~/.claude-work"
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Description (Optional)</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of this profile..."
                rows={2}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-default"
                checked={formData.is_default}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_default: !!checked }))}
              />
              <Label htmlFor="edit-default">Set as default profile</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProfile(null)}>
              Cancel
            </Button>
            <Button onClick={handleEditProfile}>
              Update Profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Help Section */}
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-base">About Claude Profiles</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <ul className="space-y-1">
            <li>• Profiles let you use different Claude configurations for different projects</li>
            <li>• Each profile uses a separate config directory (like ~/.claude, ~/.claude-work)</li>
            <li>• Choose a profile when starting each session</li>
            <li>• Profiles are independent of Claude binary selection</li>
          </ul>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Profile</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the profile "{profileToDelete?.name}"? This action cannot be undone.
              {profileToDelete?.is_default && (
                <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-sm">
                  <strong>Note:</strong> This is the default profile. Another profile will be automatically set as default.
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteProfile}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}