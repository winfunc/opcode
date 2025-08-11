import {
  File,
  FileText,
  Code,
  Image,
  Video,
  Music,
  Archive,
  Database,
  Settings,
  FileJson,
  FileType,
  Palette,
} from "lucide-react";

interface FileEntry {
  name: string;
  extension?: string;
  is_directory: boolean;
}

export const getFileIcon = (entry: FileEntry) => {
  if (entry.is_directory) {
    return null;
  }

  const extension = entry.extension?.toLowerCase() || entry.name.split('.').pop()?.toLowerCase();
  const className = "w-4 h-4";

  switch (extension) {
    // Code files
    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
    case 'vue':
    case 'svelte':
      return <Code className={`${className} text-yellow-600`} />;
    
    case 'py':
      return <Code className={`${className} text-blue-600`} />;
    
    case 'java':
      return <Code className={`${className} text-red-600`} />;
    
    case 'rs':
      return <Code className={`${className} text-orange-600`} />;
    
    case 'go':
      return <Code className={`${className} text-cyan-600`} />;
    
    case 'php':
      return <Code className={`${className} text-purple-600`} />;
    
    case 'rb':
      return <Code className={`${className} text-red-500`} />;
    
    case 'c':
    case 'cpp':
    case 'cc':
    case 'cxx':
      return <Code className={`${className} text-blue-700`} />;
    
    case 'cs':
      return <Code className={`${className} text-green-600`} />;
    
    case 'swift':
      return <Code className={`${className} text-orange-500`} />;
    
    case 'kt':
      return <Code className={`${className} text-purple-500`} />;
    
    // Web files
    case 'html':
    case 'htm':
      return <Code className={`${className} text-orange-600`} />;
    
    case 'css':
    case 'scss':
    case 'sass':
    case 'less':
      return <Palette className={`${className} text-blue-500`} />;
    
    // Config files
    case 'json':
      return <FileJson className={`${className} text-yellow-500`} />;
    
    case 'xml':
    case 'yaml':
    case 'yml':
    case 'toml':
    case 'ini':
    case 'conf':
    case 'config':
      return <Settings className={`${className} text-gray-600`} />;
    
    // Text files
    case 'md':
    case 'markdown':
      return <FileText className={`${className} text-blue-600`} />;
    
    case 'txt':
    case 'log':
      return <FileText className={`${className} text-gray-600`} />;
    
    // Images
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
    case 'ico':
    case 'bmp':
      return <Image className={`${className} text-green-600`} />;
    
    // Videos
    case 'mp4':
    case 'avi':
    case 'mov':
    case 'mkv':
    case 'webm':
      return <Video className={`${className} text-red-600`} />;
    
    // Audio
    case 'mp3':
    case 'wav':
    case 'flac':
    case 'ogg':
      return <Music className={`${className} text-purple-600`} />;
    
    // Archives
    case 'zip':
    case 'rar':
    case 'tar':
    case 'gz':
    case '7z':
      return <Archive className={`${className} text-yellow-600`} />;
    
    // Database
    case 'db':
    case 'sqlite':
    case 'sql':
      return <Database className={`${className} text-blue-700`} />;
    
    // Document formats
    case 'pdf':
      return <FileType className={`${className} text-red-500`} />;
    
    case 'doc':
    case 'docx':
      return <FileType className={`${className} text-blue-600`} />;
    
    case 'xls':
    case 'xlsx':
      return <FileType className={`${className} text-green-600`} />;
    
    case 'ppt':
    case 'pptx':
      return <FileType className={`${className} text-orange-600`} />;
    
    default:
      return <File className={`${className} text-gray-500`} />;
  }
};