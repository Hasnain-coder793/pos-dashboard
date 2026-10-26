"use client";

import { useState } from "react";
import { deleteUser, updateUser } from "@/actions/users.actions";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import ErrorBanner from "@/components/ErrorBanner";
import Modal from "@/components/Modal";
import Table from "@/components/Table";
import { Role } from "@/enums";
import type { UserRow, UsersTableProps } from "@/types";
import { formatDateTime } from "@/utils/format";
import UserForm from "./UserForm";

const roleLabels = { [Role.SUPER_ADMIN]: "Super Admin", [Role.ADMIN]: "Admin", [Role.EDITOR]: "Editor" };

type Dialog = { type: "form"; user?: UserRow } | { type: "delete"; user: UserRow } | null;

export default function UsersTable({ users }: UsersTableProps) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const close = () => {
    setDialog(null);
    setError("");
  };

  async function toggleActive(user: UserRow) {
    setError("");
    const { full_name, role, can_sell } = user;
    const result = await updateUser(user.id, { full_name, role: role as Role.ADMIN | Role.EDITOR, can_sell, is_active: !user.is_active });
    if (!result.ok) setError(result.error);
  }

  async function confirmDelete(user: UserRow) {
    setDeleting(true);
    const result = await deleteUser(user.id);
    setDeleting(false);
    if (!result.ok) return setError(result.error);
    close();
  }

  return (
    <>
      <Button onClick={() => setDialog({ type: "form" })} className="self-start">
        + Create user
      </Button>

      {!dialog && <ErrorBanner message={error} />}

      <Table headers={["Name", "Email", "Role", "Can sell", "Status", "Created", ""]} empty={!users.length}>
        {users.map((user) => (
          <tr key={user.id}>
            <td className="font-semibold">{user.full_name}</td>
            <td>{user.email}</td>
            <td>{roleLabels[user.role]}</td>
            <td>{user.can_sell || user.role !== Role.ADMIN ? "Yes" : "No"}</td>
            <td>
              <Badge variant={user.is_active ? "solid" : "outline"}>{user.is_active ? "Active" : "Inactive"}</Badge>
            </td>
            <td className="whitespace-nowrap">{formatDateTime(user.created_at)}</td>
            <td>
              {user.role === Role.SUPER_ADMIN ? (
                <p className="text-right text-neutral-500">Protected</p>
              ) : (
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setDialog({ type: "form", user })}>
                    Edit
                  </Button>
                  <Button variant="secondary" onClick={() => toggleActive(user)}>
                    {user.is_active ? "Deactivate" : "Activate"}
                  </Button>
                  <Button variant="secondary" onClick={() => setDialog({ type: "delete", user })}>
                    Delete
                  </Button>
                </div>
              )}
            </td>
          </tr>
        ))}
      </Table>

      {dialog?.type === "form" && <UserForm user={dialog.user} onClose={close} />}

      {dialog?.type === "delete" && (
        <Modal title="Delete user" onClose={close}>
          <p className="text-sm">
            Permanently delete <span className="font-semibold">{dialog.user.full_name}</span> ({roleLabels[dialog.user.role]})? They will no
            longer be able to sign in to the dashboard or the POS.
          </p>
          <ErrorBanner message={error} />
          <Button onClick={() => confirmDelete(dialog.user)} disabled={deleting}>
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </Modal>
      )}
    </>
  );
}
