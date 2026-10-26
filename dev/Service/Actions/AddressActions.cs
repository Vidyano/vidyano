using Dev.Service.Model;
using Vidyano.Service.Repository;

namespace Dev.Service.Actions;

/// <summary>
/// Person_Addresses has a lookup (Database.Addresses) for the built-in Add action, its added addresses are undone by
/// PersistentObject.ResetTest (DevContext.Initialize).
/// </summary>
public partial class AddressActions
{
    const string PersonAddresses = "Person_Addresses";

    public override void OnConstruct(Query query, PersistentObject? parent)
    {
        base.OnConstruct(query, parent);

        if (query.Name == PersonAddresses)
            query.EnableSelectAll = true;
    }

    public override void OnAddReference(PersistentObject? parent, IEnumerable<Address> entities, Query query, QueryResultItem[] selectedItems)
    {
        if (query.Name != PersonAddresses || parent == null)
        {
            base.OnAddReference(parent, entities, query, selectedItems);
            return;
        }

        var person = Context.People.First(p => p.Id.ToString() == parent.ObjectId);
        var ids = selectedItems.Select(i => i.Id).ToHashSet();
        var added = Context.Addresses.Where(a => ids.Contains(a.Id.ToString()) && !person.Addresses.Contains(a)).ToList();

        lock (person.Addresses)
            person.Addresses.AddRange(added);
    }
}
