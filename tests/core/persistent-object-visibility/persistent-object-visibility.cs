#!/usr/bin/dotnet run
#:sdk Microsoft.NET.Sdk.Web
#:property PublishAot=false
#:package Vidyano@6.0.*

// ============================================================================
// Test Backend: Attribute Visibility
// ============================================================================
//
// Tests attribute visibility changes and their effect on tabs and groups.
// When attributes are hidden via OnRefresh, the tabs and groups containing
// only hidden attributes should also become hidden.
//
// ============================================================================

using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.AspNetCore.Builder;
using Vidyano.Service;
using Vidyano.Service.Repository;

var builder = WebApplication.CreateBuilder(args);

builder.AddVidyanoMinimal<TestContext>(vidyano => vidyano
    .WithDefaultAdmin()
    .WithDefaultUser("Admin")
    .WithSchemaRights()
    .WithMenuItem("VisibilityTestItems")
    .WithModel(b =>
    {
        var item = b.GetPersistentObject("VisibilityTestItem")!;

        // Main tab - General group
        item.GetOrCreateAttribute("Name").GroupLabel = "General";
        item.GetOrCreateAttribute("Description").GroupLabel = "General";
        item.GetOrCreateAttribute("ViewMode").GroupLabel = "General";

        // Main tab - Optional group
        item.GetOrCreateAttribute("Notes").GroupLabel = "Optional";
        item.GetOrCreateAttribute("Tags").GroupLabel = "Optional";

        // Advanced tab - Technical group
        item.GetOrCreateAttribute("InternalCode").TabLabel = "Advanced";
        item.GetOrCreateAttribute("InternalCode").GroupLabel = "Technical";
        item.GetOrCreateAttribute("CreatedDate").TabLabel = "Advanced";
        item.GetOrCreateAttribute("CreatedDate").GroupLabel = "Technical";

        // Advanced tab - Audit group
        item.GetOrCreateAttribute("ModifiedDate").TabLabel = "Advanced";
        item.GetOrCreateAttribute("ModifiedDate").GroupLabel = "Audit";

        // ViewMode triggers refresh
        item.GetOrCreateAttribute("ViewMode").TriggersRefresh = true;
        item.GetOrCreateAttribute("ViewMode").DataType = DataTypes.DropDown;
    }));

var app = builder.Build();
app.UseVidyano(app.Environment, app.Configuration);
app.Run();

// === Context ===
public class TestContext : NullTargetContext
{
    private static readonly List<VisibilityTestItem> items =
    [
        new VisibilityTestItem
        {
            Id = "1",
            Name = "Test Item",
            Description = "A test item for visibility testing",
            Notes = "Some optional notes",
            Tags = "test, visibility",
            InternalCode = "INT-001",
            CreatedDate = DateTime.Today.AddDays(-30),
            ModifiedDate = DateTime.Today
        }
    ];

    public TestContext()
    {
        Register(items);
    }

    public IQueryable<VisibilityTestItem> VisibilityTestItems => Query<VisibilityTestItem>();

    public override void AddObject(PersistentObject obj, object entity)
    {
        if (entity is VisibilityTestItem item)
            item.Id ??= Guid.NewGuid().ToString("N")[..8];
        base.AddObject(obj, entity);
    }
}

// === Entity ===
public class VisibilityTestItem
{
    public string Id { get; set; } = string.Empty;

    // General group (Main tab)
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string ViewMode { get; set; } = "Show All";

    // Optional group (Main tab)
    public string? Notes { get; set; }
    public string? Tags { get; set; }

    // Technical group (Advanced tab)
    public string? InternalCode { get; set; }
    public DateTime CreatedDate { get; set; }

    // Audit group (Advanced tab)
    public DateTime ModifiedDate { get; set; }
}

// === Actions ===
public class VisibilityTestItemActions(TestContext context)
    : PersistentObjectActions<TestContext, VisibilityTestItem>(context)
{
    public override void OnConstruct(PersistentObject obj)
    {
        base.OnConstruct(obj);

        obj[nameof(VisibilityTestItem.ViewMode)].Options =
        [
            "Show All",
            "Hide Advanced Tab",
            "Hide Optional Group",
            "Minimal View",
            "Hide Audit Only",
            "Hide Single Attr In Optional",
            "Hide Technical Only"
        ];
    }

    public override void OnNew(
        PersistentObject obj,
        PersistentObject? parent,
        Query? query,
        Dictionary<string, string>? parameters)
    {
        base.OnNew(obj, parent, query, parameters);

        obj[nameof(VisibilityTestItem.ViewMode)] = "Show All";
        obj[nameof(VisibilityTestItem.CreatedDate)] = DateTime.Today;
        obj[nameof(VisibilityTestItem.ModifiedDate)] = DateTime.Today;
    }

    /// <summary>
    /// OnRefresh: Called when ViewMode changes (TriggersRefresh=true).
    /// Changes attribute visibility based on selected view mode.
    /// </summary>
    public override void OnRefresh(RefreshArgs args)
    {
        base.OnRefresh(args);

        var obj = args.PersistentObject;

        if (args.Attribute.Name != nameof(VisibilityTestItem.ViewMode))
            return;

        var viewMode = (string?)args.Attribute;

        switch (viewMode)
        {
            case "Show All":
                foreach (var attr in obj.Attributes)
                    attr.Visibility = AttributeVisibility.Always;
                break;

            case "Hide Advanced Tab":
                foreach (var attr in obj.Attributes)
                {
                    attr.Visibility = attr.TabName == "Advanced"
                        ? AttributeVisibility.Never
                        : AttributeVisibility.Always;
                }
                break;

            case "Hide Optional Group":
                foreach (var attr in obj.Attributes)
                {
                    attr.Visibility = attr.GroupName == "Optional"
                        ? AttributeVisibility.Never
                        : AttributeVisibility.Always;
                }
                break;

            case "Minimal View":
                foreach (var attr in obj.Attributes)
                {
                    var isEssential = attr.Name is nameof(VisibilityTestItem.Name)
                        or nameof(VisibilityTestItem.Description)
                        or nameof(VisibilityTestItem.ViewMode);
                    attr.Visibility = isEssential
                        ? AttributeVisibility.Always
                        : AttributeVisibility.Never;
                }
                break;

            case "Hide Audit Only":
                // Hides only the Audit group (single attr: ModifiedDate)
                // Technical group stays visible, so Advanced tab stays visible
                foreach (var attr in obj.Attributes)
                {
                    attr.Visibility = attr.GroupName == "Audit"
                        ? AttributeVisibility.Never
                        : AttributeVisibility.Always;
                }
                break;

            case "Hide Single Attr In Optional":
                // Hides only Notes, keeps Tags visible
                // Optional group still has visible content
                foreach (var attr in obj.Attributes)
                {
                    attr.Visibility = attr.Name == nameof(VisibilityTestItem.Notes)
                        ? AttributeVisibility.Never
                        : AttributeVisibility.Always;
                }
                break;

            case "Hide Technical Only":
                // Hides Technical group, keeps Audit visible
                // Advanced tab stays visible (has Audit group)
                foreach (var attr in obj.Attributes)
                {
                    attr.Visibility = attr.GroupName == "Technical"
                        ? AttributeVisibility.Never
                        : AttributeVisibility.Always;
                }
                break;
        }
    }
}
