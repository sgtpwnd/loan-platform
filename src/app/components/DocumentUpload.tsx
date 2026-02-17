import { useState, DragEvent, useRef } from "react";
import { CloudUpload } from "lucide-react";
import { Button } from "./ui/button";

type Props = {
  onUpload?: (file: File) => void;
  isUploading?: boolean;
  uploadedUrl?: string | null;
};

export default function DocumentUpload({ onUpload, isUploading, uploadedUrl }: Props) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFile = (file?: File) => {
    if (file && onUpload) onUpload(file);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center gap-3 text-sm ${
        dragging ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-gray-50"
      }`}
    >
      <CloudUpload className="text-gray-500" />
      <p className="text-gray-700 text-center">
        Drag & drop insurance documents here, or click to browse
      </p>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <Button
        variant="secondary"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={isUploading}
      >
        {isUploading ? "Uploading..." : "Choose File"}
      </Button>
      {uploadedUrl ? <p className="text-green-600 text-xs">Uploaded: {uploadedUrl}</p> : null}
    </div>
  );
}
