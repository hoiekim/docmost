import { useState } from "react";
import { ActionIcon, Button, FileButton, Group, Loader, Text } from "@mantine/core";
import { IconPaperclip, IconUpload, IconX } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { uploadFile } from "@/features/page/services/page-service";
import { getFileUrl } from "@/lib/config";
import { getApiErrorMessage } from "@/lib/api-error";
import type { FileValue } from "../../types";
import { asFileList } from "../../model/cell-read";
import { useBase } from "../base-context";
import type { CellProps } from "./cell-types";
import { EditorPopover } from "./editor-popover";
import classes from "../../styles/cells.module.css";

function fileHref(f: FileValue): string {
  return getFileUrl(f.url || `/api/files/${f.id}/${encodeURIComponent(f.fileName)}`);
}

export function FileCell(props: CellProps) {
  const { value, variant, editing, editable, onChange, onCancel, onRequestEdit } = props;
  const { t } = useTranslation();
  const { pageId } = useBase();
  const files = asFileList(value);
  const [uploading, setUploading] = useState(false);

  const display = (
    <span
      className={classes.chipRow}
      data-variant={variant}
      data-empty={files.length === 0 || undefined}
      onClick={(e) => {
        if (editable && !editing && variant !== "card") {
          e.stopPropagation();
          onRequestEdit();
        }
      }}
    >
      {files.map((f) => (
        <a
          key={f.id}
          href={fileHref(f)}
          target="_blank"
          rel="noopener noreferrer"
          className={classes.fileChip}
          title={f.fileName}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <IconPaperclip size={12} />
          <span>{f.fileName}</span>
        </a>
      ))}
    </span>
  );

  if (!editable || variant === "card") return display;

  const upload = async (picked: File | null) => {
    if (!picked) return;
    setUploading(true);
    try {
      const att = await uploadFile(picked, pageId);
      const next: FileValue = {
        id: att.id,
        fileName: att.fileName,
        mimeType: att.mimeType,
        fileSize: att.fileSize,
        url: `/api/files/${att.id}/${att.fileName}`,
      };
      onChange([...files, next]);
    } catch (err) {
      notifications.show({ message: getApiErrorMessage(err, t("Upload failed")), color: "red" });
    } finally {
      setUploading(false);
    }
  };

  const remove = (id: string) => {
    const next = files.filter((f) => f.id !== id);
    onChange(next.length ? next : null);
  };

  return (
    <EditorPopover opened={editing} onClose={onCancel} target={display} width={300}>
      <div className={classes.picker}>
        <div className={classes.pickerList}>
          {files.map((f) => (
            <div key={f.id} className={classes.fileRow}>
              <IconPaperclip size={14} className={classes.pickerIcon} />
              <a
                href={fileHref(f)}
                target="_blank"
                rel="noopener noreferrer"
                className={classes.link}
                style={{ flex: 1, minWidth: 0 }}
              >
                <Text size="sm" truncate>
                  {f.fileName}
                </Text>
              </a>
              <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => remove(f.id)} aria-label={t("Remove")}>
                <IconX size={14} />
              </ActionIcon>
            </div>
          ))}
          {files.length === 0 && (
            <Text size="sm" c="dimmed" p="xs">
              {t("No files")}
            </Text>
          )}
        </div>
        <Group p="xs" justify="space-between">
          <FileButton onChange={(f) => void upload(f)}>
            {(btnProps) => (
              <Button
                {...btnProps}
                size="compact-xs"
                variant="light"
                leftSection={uploading ? <Loader size={12} /> : <IconUpload size={14} />}
                disabled={uploading}
              >
                {t("Upload file")}
              </Button>
            )}
          </FileButton>
          <Button size="compact-xs" variant="subtle" color="gray" onClick={onCancel}>
            {t("Done")}
          </Button>
        </Group>
      </div>
    </EditorPopover>
  );
}
