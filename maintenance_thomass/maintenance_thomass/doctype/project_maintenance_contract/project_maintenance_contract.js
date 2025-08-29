// Copyright (c) 2025, thomas and contributors
// For license information, please see license.txt

frappe.ui.form.on("Project Maintenance Contract", {
    customer_name:function(frm) {
            details(frm)
        },
    contract_title:function(frm){
        if(frm.doc.contract_title){
            frappe.call({
                method:"maintenance_thomass.maintenance_thomass.doctype.project_maintenance_contract.project_maintenance_contract.contract_id",
                args:{
                    title:frm.doc.contract_title
                },
            callback:function(r){
                frm.set_value("contract_id",r.message)
            }


            })
        }
    },
    contract_start_date:function(frm){
        date_diff(frm)
    },
    contract_end_date:function(frm){
        date_diff(frm)
    },
    refresh: function(frm) {
        frm.fields_dict["maintenance_task"].grid.get_field("uom").get_query = function() {
            return {
                filters: {
                    name: ["in", ["visit", "hrs", "session"]]
                }
            }
        }
        if (frm.doc.docstatus === 1) {
            frm.add_custom_button("Update Contract Status", function() {
                frappe.prompt(
                    [
                        {
                            fieldname: 'status',
                            label: 'Select Status',
                            fieldtype: 'Select',
                            options: ['Completed', 'Terminated'],
                            reqd: 1
                        }
                    ],
                    function(values) {
                        frappe.confirm(
                            `Are you sure you want to change status to <b>${values.status}</b>?`,
                            function() {
                                frappe.call({
                                    method: "maintenance_thomass.maintenance_thomass.doctype.project_maintenance_contract.project_maintenance_contract.change_status",
                                    args: {
                                        docname: frm.doc.name,
                                        status: values.status
                                    },
                                    callback: function(r) {
                                        if (!r.exc) {
                                            frappe.msgprint(`Status changed to ${values.status}`)
                                            frm.reload_doc()
                                        }
                                    }
                                })
                            }
                        )
                    },
                    'Change Status',
                    'Submit'
                )
            })
        }
        if (frm.doc.docstatus === 1) {
            frm.add_custom_button("Summary", function() {
            let d = new frappe.ui.Dialog({
            title: 'Summery',
            fields: [
                {
                    label: 'Contract Title',
                    fieldname: 'contract_title',
                    fieldtype: 'Data',
                    default: frm.doc.contract_title,
                    read_only: 1
                },
                {
                    label: 'Contract Type',
                    fieldname: 'contract_type',
                    fieldtype: 'Data',
                    default: frm.doc.contract_type,
                    read_only: 1
                },
                {
                    label: 'Total Estimated Hours',
                    fieldname: 'total_estimated_hours',
                    fieldtype: 'Data',
                    default: frm.doc.total_estimated_hours,
                    read_only: 1
                },
                {
                    label: 'Total Contract Value',
                    fieldname: 'total_contract_value',
                    fieldtype: 'Data',
                    default: frm.doc.total_contract_value,
                    read_only: 1
                },
            ],
           primary_action_label: 'Confirm',
        secondary_action_label: 'Cancel',
        primary_action() {
            d.hide()
        },
        secondary_action() {
            d.hide()
        }
    })

    d.show()
})

         }
        frm.fields_dict["maintenance_task"].grid.get_field("service_item").get_query = function(doc, cdt, cdn) {
            return {
                filters: {
                    is_stock_item:0
                }
            }
        }

       
        
    },
    validate:function(frm){
        let total_estimated_hours = 0 
        let total_contract_value = 0 
        let total_invoice = 0 
        frm.doc.maintenance_task.forEach(row=>{ 
            total_estimated_hours += row.estimated_hours || 0 
            total_contract_value += row.total_cost || 0 }) 
        frm.doc.billing_schedule.forEach(row=>{ 
            total_invoice += row.invoice_amount || 0 }) 
            
            frm.set_value("total_estimated_hours",total_estimated_hours) 
            frm.set_value("total_contract_value",total_contract_value) 
            frm.set_value("total_invoiced_amount",total_invoice) 
            frm.set_value("pending_balance",total_contract_value - total_invoice) 
            

        let has_overdue = (frm.doc.billing_schedule || []).some(row => {
            return row.invoice_date < frm.doc.created_on && row.invoice_status !== "Paid"
        })

        if (has_overdue) {
            setTimeout(function() {
            frm.add_custom_button("Generate Next Invoice", function() {

                (frm.doc.billing_schedule || []).forEach(row => {
                    if (row.invoice_date < frm.doc.created_on && row.invoice_status !== "Paid") {
                        let next_date = frappe.datetime.add_days(row.created_on, 1)

                    
                        let exists = (frm.doc.billing_schedule || []).some(r => {
                            return (
                                r.invoice_date === next_date &&
                                r.invoice_amount === row.invoice_amount &&
                                r.invoice_status === "Overdue"
                            )
                        })

                        if (!exists) {
                            
                            frm.add_child("billing_schedule", {
                                invoice_date: next_date,
                                invoice_amount: row.invoice_amount,
                                invoice_status: "Overdue"
                            })
                        
                        }
                    }
                })

                frm.refresh_field("billing_schedule")
                frappe.msgprint(__("Next invoices generated for overdue items"))
            })
        },300)
        }
    }
})
        
function date_diff(frm) {
    if (frm.doc.contract_start_date && frm.doc.contract_end_date) {
        let start = frappe.datetime.str_to_obj(frm.doc.contract_start_date)
        let end = frappe.datetime.str_to_obj(frm.doc.contract_end_date)
        let diff = frappe.datetime.get_day_diff(end, start)

        if (diff < 0) {
            frappe.msgprint(__("End Date cannot be before Start Date"))
            frm.set_value("contract_end_date", "")
            frm.set_value("duration", 0)
        } else {
            frm.set_value("duration", diff+1)
        }
    }
}
function calc(frm,cdt,cdn){
    let row = locals[cdt][cdn]
    let hours = row.estimated_hours || 0
    let rate = row.rate_per_hour || 0
    frappe.model.set_value(cdt,cdn,"total_cost",hours*rate)
    }
function details(frm){
    if(frm.doc.customer_name){
                frappe.call({
                    method:"maintenance_thomass.maintenance_thomass.doctype.project_maintenance_contract.project_maintenance_contract.get_customer",
                    args:{
                        customer:frm.doc.customer_name
                    },
                callback:function(r){
                    if (r.message) {
                            frm.set_value("customer_email", r.message.email || "")
                            frm.set_value("customer_contact_number", r.message.phone || "")
                            frm.set_value("billing_address", r.message.address || "")
                        }

                }

                })
            }
    }
frappe.ui.form.on("Maintenance Task", {
    estimated_hours:function(frm,cdt,cdn){
        calc(frm,cdt,cdn)
    },
    rate_per_hour:function(frm,cdt,cdn){
        calc(frm,cdt,cdn)
    },
   

})
      