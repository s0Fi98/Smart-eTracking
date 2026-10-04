// Presentation hints only. The API independently enforces every scope and write.
export function canView(user, mode, resource) {
  if (["overview", "help"].includes(resource)) return true;
  return mode === "demo" || !!user?.access?.permissions?.[resource]?.read;
}
export function canCreate(user, mode, resource, config) {
  return (
    !!config?.fields &&
    (mode === "demo" || !!user?.access?.permissions?.[resource]?.create)
  );
}
export function permittedFields(user, mode, resource, config, record) {
  return (config?.fields || [])
    .filter((field) => {
      if (!record) return !field.editOnly;
      if (
        field.createOnly ||
        field.immutable ||
        (config.edit && !config.edit.includes(field.key))
      )
        return false;
      return (
        mode === "demo" || !!record._access?.updateFields?.includes(field.key)
      );
    })
    .map((field) =>
      field.key === "organizationId" && resource === "users"
        ? { ...field, required: mode !== "demo" && !user?.access?.superAdmin }
        : field,
    );
}
export function navigationFor(groups, tabs, user, mode) {
  return groups
    .map((group) => ({
      ...group,
      items: group.items
        .map(([key, name]) => {
          const target = canView(user, mode, key)
            ? key
            : tabs[key]?.find((tab) => canView(user, mode, tab));
          return target ? [target, name] : null;
        })
        .filter(Boolean),
    }))
    .filter((group) => group.items.length);
}

export function fieldOptions(
  user,
  mode,
  resource,
  field,
  options,
  selected = {},
) {
  const values = field.values || options[field.source] || [];
  if (mode === "demo" || user?.access?.superAdmin) return values;
  const access = user?.access || {};
  const managesOrg = (id) =>
    access.managedOrganizationIds?.includes(Number(id));
  const lease = options.leases?.find(
    (row) => row.id === Number(selected.leaseId),
  );
  if (resource === "memberships" && field.key === "role") {
    return access.ownerOrganizationIds?.includes(
      Number(selected.organizationId),
    )
      ? values
      : values.filter((role) => !["OWNER", "ADMIN"].includes(role));
  }
  if (resource === "assignments" && field.key === "role")
    return managesOrg(lease?.organizationId)
      ? values
      : values.filter((role) => role !== "MANAGER");
  if (
    field.key === "organizationId" &&
    ["users", "memberships"].includes(resource)
  )
    return values.filter((row) => managesOrg(row.id));
  if (field.key === "parkingAreaId")
    return values.filter((row) => access.managedSiteIds?.includes(row.id));
  if (field.key === "leaseId")
    return values.filter(
      (row) =>
        managesOrg(row.organizationId) ||
        access.managedLeaseIds?.includes(row.id),
    );
  if (field.key === "memberId" && lease)
    return values.filter((row) => row.organizationId === lease.organizationId);
  return values;
}
