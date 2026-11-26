import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FileCode2, FileText, Folder, FolderOpen } from "lucide-react";

function DirectoryTree({ files, selectedFileId, onFileSelect }) {
  const [expandedFolders, setExpandedFolders] = useState({});

  const tree = useMemo(() => {
    const root = { folders: {}, files: [] };

    files.forEach((file) => {
      const filePath = file.path || file.name || "";
      const parts = filePath.split("/").filter(Boolean);
      const fileName = file.name || parts.pop() || "Unnamed file";
      const folderParts = parts.slice(0, -1);
      let current = root;

      folderParts.forEach((folderName) => {
        if (!current.folders[folderName]) {
          current.folders[folderName] = { folders: {}, files: [] };
        }
        current = current.folders[folderName];
      });

      current.files.push({ ...file, displayName: fileName });
    });

    return root;
  }, [files]);

  function toggleFolder(folderPath) {
    setExpandedFolders((current) => ({
      ...current,
      [folderPath]: !current[folderPath],
    }));
  }

  function renderNode(node, parentPath = "", depth = 0) {
    const folderEntries = Object.entries(node.folders).sort(([a], [b]) => a.localeCompare(b));
    const sortedFiles = [...node.files].sort((a, b) => a.displayName.localeCompare(b.displayName));

    return (
      <div>
        {folderEntries.map(([folderName, folderNode]) => {
          const folderPath = parentPath ? `${parentPath}/${folderName}` : folderName;
          const isExpanded = expandedFolders[folderPath] ?? true;

          return (
            <div key={folderPath}>
              <button
                type="button"
                onClick={() => toggleFolder(folderPath)}
                className="flex w-full items-center gap-2 border-b border-[#E5E7EC] px-5 py-3 text-left text-sm text-[#5B6058] transition hover:bg-[#FAF8F1] hover:text-[#4F574F]"
                style={{ paddingLeft: `${12 + depth * 16}px` }}
              >
                {isExpanded ? <ChevronDown size={15} className="text-[#92948A]"/> : <ChevronRight size={15} className="text-[#92948A]"/>}
                {isExpanded ? <FolderOpen size={16} className="text-[#7F8C77]"/> : <Folder size={16} className="text-[#7F8C77]"/>}
                <span className="truncate">{folderName}</span>
              </button>

              {isExpanded && (
                <div>{renderNode(folderNode, folderPath, depth + 1)}</div>
              )}
            </div>
          );
        })}

        {sortedFiles.map((file) => (
          <button
            key={file.id}
            type="button"
            onClick={() => onFileSelect(file)}
            className={`flex w-full items-center gap-2 border-b border-[#E5E7EC] px-5 py-3 text-left text-sm transition ${
              selectedFileId === file.id
                ? "bg-[#F0F1F4] text-[#438C89]"
                : "text-[#438C89] hover:bg-[#FAF8F1] hover:underline"
            }`}
            style={{ paddingLeft: `${12 + depth * 16}px` }}
          >
            {file.displayName.toLowerCase().endsWith(".md") || file.displayName.toLowerCase().endsWith(".txt") ? <FileText size={16} className="text-[#92948A]"/> : <FileCode2 size={16} className="text-[#92948A]"/>}
            <span className="truncate">{file.displayName}</span>
          </button>
        ))}
      </div>
    );
  }

  if (files.length === 0) {
    return <p className="px-3 py-4 text-sm text-[#92948A]">No files available</p>;
  }

  return <div className="space-y-1">{renderNode(tree)}</div>;
}

export default DirectoryTree;
