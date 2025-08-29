# Copyright (c) 2025, thomas and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

@frappe.whitelist()
def get_customer(customer):
    addresses = frappe.get_all(
        "Address",
        fields=["name"],
        filters={"address_type": "Billing"},
        order_by="creation desc"
    )

    for addr in addresses:
        addr_doc = frappe.get_doc("Address", addr.name)

        for link in addr_doc.links:
            if link.link_doctype == "Customer" and link.link_name == customer:
            
                full_address = "\n".join(filter(None, [
                    addr_doc.address_line1,
                    addr_doc.address_line2,
                    addr_doc.city,
                    addr_doc.state,
                    addr_doc.pincode,
                    addr_doc.country
                ]))

                return {
                    "email": addr_doc.email_id,
                    "phone": addr_doc.phone,
                    "address": full_address
                }

    return {
        "email": None,
        "phone": None,
        "address": None
    }

@frappe.whitelist()
def contract_id(title=None):


	name = title.replace(" ", "")
	date_str = frappe.utils.now_datetime().strftime("%m%y")

	series_key = f"{name}-MC-{date_str}-"
	serial = frappe.model.naming.make_autoname(f"{series_key}.###")

	return serial

@frappe.whitelist()
def change_status(docname, status):
	if status not in ["Completed", "Terminated"]:
		frappe.throw("Invalid status")

	doc = frappe.get_doc("Project Maintenance Contract", docname)
	if doc.docstatus != 1:
		frappe.throw("Document must be submitted before changing status")
	frappe.db.set_value("Project Maintenance Contract", docname, "status", status)

	return {"status": status}
class ProjectMaintenanceContract(Document):
	def validate(self):
		if self.total_estimated_hours ==0:
			frappe.throw("Total Hours shouldn't be zero")
		
		if self.total_contract_value ==0:
			frappe.throw("Total Contract Value shouldn't be zero")
		for i in self.maintenance_task:
			if not i.description:
				frappe.throw("Description needed")
		if self.customer_name:
			customer = get_customer(self.customer_name)
			if customer:
				self.customer_email = customer.get("email")
				self.customer_contact_number = customer.get("phone")
				self.billing_address = customer.get("address")

		if self.contract_title and not self.contract_id:
			self.contract_id = contract_id(self.contract_title)

		if self.total_invoiced_amount > self.total_contract_value:
			frappe.throw("Invoiced amount exceeded total contract value")